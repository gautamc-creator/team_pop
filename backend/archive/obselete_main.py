

@app.post("/stt")
@observe(name="stt-call" , as_type="generation")
async def speech_to_text(file: UploadFile):
    """
    Accepts an audio file (webm/wav/mp3),
    sends it to Whisper,
    returns transcribed text.
    """

    if file is None:
        raise HTTPException(status_code=400, detail="Audio file is required")

    try:
        # Read audio bytes
        audio_bytes = await file.read()

        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file")

        # Whisper requires file-like object with name
        audio_buffer = io.BytesIO(audio_bytes)
        audio_buffer.name = file.filename or "audio.webm"
        
        config = aai.TranscriptionConfig(speech_models=["universal"])

        transcript = aai.Transcriber(config=config).transcribe(audio_buffer)
        
        logging.info(f"Transcript: {transcript.text}")
        
        if transcript.status == "error":
            raise RuntimeError(f"Transcription failed: {transcript.error}")

        

        # Call Whisper

        
        return JSONResponse(
            content={"text":transcript.text},
            status_code=200
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"STT failed: {str(e)}"
        )

@app.post("/chat")
@observe(name="chat" , as_type="generation")
async def chat(req: ChatRequest):
    
    try:
        # 1. Extract the latest query (the last message from the user)
        if not req.messages:
             raise HTTPException(status_code=400, detail="No messages provided")
        
        latest_query = req.messages[-1].content
        
        target_index = "sensesindia-v2"
        if req.domain:
            target_index = generate_index_name(req.domain)
            logging.info(f"🔍 Searching specific index: {target_index}")
        
        # 2. Get Context based on the LATEST query only
        try:
            # Assuming get_llm_context is synchronous, run it in a thread pool
            context_text, source_urls = await asyncio.to_thread(get_llm_context, latest_query, index_name=target_index)
        except ValueError as e:
            return {
                "answer": "I couldn’t find a crawl index yet. Please crawl the site and try again.",
                "summary": "Crawl index not found. Please crawl the site first.",
                "sources": []
            }
        logging.info(f"🔍 Context: {context_text}")
        # 3. Construct the System Prompt
        SYSTEM_PROMPT = f"""
                ### ROLE
                You are an elite Personal Stylist for [Brand Name]. You are knowledgeable, fashion-forward, and sales-oriented.

                ### OBJECTIVES
                1. **Soft Match:** Never say "No". Suggest alternatives.
                2. **Style Advice:** Briefly explain *why* an item is good.
                3. **Mobile-First Response:**
                   - **Audio (summary):** Max 15 words. High energy.
                   - **Visual (answer):** Concise. Focus on benefits.
                
                ### INPUT CONTEXT
                {context_text}

                ### OUTPUT FORMAT (JSON ONLY)
                {{
                    "summary": "Short, punchy sentence for TTS audio.",
                    "answer": "The text bubble version.",
                    "products": [
                        {{
                            "name": "Product Name",
                            "price": "Price (e.g. ₹2,500)",
                            "image_url": "https://...", 
                            "product_url": "https://..."
                        }}
                    ]
                }}

                ### CONSTRAINTS
                - If no products match, return "products": [].
                - **Crucial:** Always try to find the 'product_url' so the user can buy it.
                - If image is missing, leave 'image_url' empty (frontend will handle it).
            """

        # 4. Format History for Gemini
        gemini_history = []
        
        for msg in req.messages[:-1]: # All messages except the last one
            role = "user" if msg.role == "user" else "model"
            gemini_history.append(types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg.content)]
            ))

        # 5. Call Gemini (Async Wrapper if client is sync)
        # Using run_in_executor to avoid blocking the event loop
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=gemini_history + [types.Content(role="user", parts=[types.Part.from_text(text=latest_query)])],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.3,
            )
        )

        logging.info(f"🔍 Response: {response}")

        answer = response.text
        summary = ""
        try:
            # Clean up potential markdown formatting in JSON response
            cleaned_text = response.text.strip()
            
            # Robustly extract JSON if wrapped in code blocks or other text
            import re
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned_text, re.DOTALL)
            if json_match:
                 cleaned_text = json_match.group(1)
            else:
                # If no code blocks, try to find the first '{' and last '}'
                # This handles cases where the LLM might output text before/after the JSON without code blocks
                first_brace = cleaned_text.find('{')
                last_brace = cleaned_text.rfind('}')
                if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                    cleaned_text = cleaned_text[first_brace:last_brace+1]
            
             # Attempt to parse
            parsed = json.loads(cleaned_text, strict=False)
            
            summary = parsed.get("summary", "")
            answer = parsed.get("answer", "")
            products = parsed.get("products", []) # NEW: Extract products
            
            # Fallback: If answer is empty, use summary. If summary is empty, use generic error.
            if not answer and summary:
                answer = summary
            
            # DEFAULT "SORRY" MESSAGE LOGIC
            if not summary:
                 fallback_msg = "I'm sorry, I don't have that information right now, but I'd love to help with something else!"
                 summary = fallback_msg
                 if not answer:
                     answer = fallback_msg
                 sources = []
            else:
                 # 'sources' gets the array of links ONLY if we found an answer
                sources = [p.get('product_url') for p in products if p.get('product_url')]
           
        except Exception as e:
            logging.warning(f"Failed to parse JSON from LLM response: {e}. Raw text: {response.text}")
            
            # FALLBACK: Try to rescue via Regex
            import re
            summary_match = re.search(r'"summary"\s*:\s*"(.*?)"', response.text, re.DOTALL)
            answer_match = re.search(r'"answer"\s*:\s*"(.*?)"', response.text, re.DOTALL)
            
            if summary_match:
                 summary = summary_match.group(1).replace(r'\n', '\n').replace(r'\"', '"')
            else:
                 summary = "I'm sorry, I don't have that information right now."
            
            if answer_match:
                 answer = answer_match.group(1).replace(r'\n', '\n').replace(r'\"', '"')
            else:
                 answer = summary # Fallback to summary if answer extraction fails
                 
            sources = []
            products = []
            
        return {
            "answer": answer, 
            "summary": summary,
            "sources": sources,
            "products": products
        }

    except Exception as e:
        logging.error(f"Chat Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post('/tts')
@observe(name="tts-call" , as_type="generation")
async def text_to_speech(request: TTSRequest):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    
    data = {
        "text": request.text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    }

    # 3. Call the Provider
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code != 200:
        logging.error(f"❌ ElevenLabs Error: {response.text}") # Look at your terminal!
        return Response(content=response.content, status_code=500)

    # 4. Return Audio Bytes directly to frontend
    return Response(content=response.content, media_type="audio/mpeg")


 