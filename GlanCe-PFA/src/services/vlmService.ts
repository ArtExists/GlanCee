import { BoundingBox, VLMIdentificationResult, WikipediaSummary } from '../types';

export class VLMService {
  private anthropicApiKey: string = '';
  private mistralApiKey: string = '';
  private geminiApiKey: string = '';
  private openaiApiKey: string = '';
  private groqApiKey: string = '';
  private backendUrl: string = 'http://localhost:8000';

  public setAnthropicApiKey(key: string) {
    this.anthropicApiKey = key || '';
  }

  public setMistralApiKey(key: string) {
    this.mistralApiKey = key || '';
  }

  public setGeminiApiKey(key: string) {
    this.geminiApiKey = key || '';
  }

  public setOpenaiApiKey(key: string) {
    this.openaiApiKey = key || '';
  }

  public setGroqApiKey(key: string) {
    this.groqApiKey = key || '';
  }

  public setBackendUrl(url: string) {
    this.backendUrl = url || 'http://localhost:8000';
  }

  /**
   * Helper to perform fetch with local Vite proxy fallback (bypasses browser CORS)
   */
  private async fetchWithProxyFallback(
    proxyPath: string,
    directUrl: string,
    options: RequestInit
  ): Promise<Response> {
    // 1. Try local dev proxy endpoint first (avoids browser CORS)
    try {
      const proxyRes = await fetch(proxyPath, options);
      // If proxy route exists and answered (even with API errors), return it
      if (proxyRes.status !== 404 && proxyRes.status !== 502) {
        return proxyRes;
      }
    } catch {
      // Proxy failed or not running, fall through to direct call
    }

    // 2. Fall back to direct external API endpoint
    return await fetch(directUrl, options);
  }

  /**
   * Crop image from video/image source based on normalized bounding box (with optional padding)
   */
  public cropImage(
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    box: BoundingBox,
    paddingPercent: number = 0.10
  ): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const sourceWidth = 'videoWidth' in source ? source.videoWidth : source.width;
    const sourceHeight = 'videoHeight' in source ? source.videoHeight : source.height;

    // Apply padding
    const padW = box.width * paddingPercent;
    const padH = box.height * paddingPercent;

    const rawX = Math.max(0, box.x - padW);
    const rawY = Math.max(0, box.y - padH);
    const rawW = Math.min(1 - rawX, box.width + padW * 2);
    const rawH = Math.min(1 - rawY, box.height + padH * 2);

    const sx = Math.max(0, rawX * sourceWidth);
    const sy = Math.max(0, rawY * sourceHeight);
    const sWidth = Math.max(10, Math.min(sourceWidth - sx, rawW * sourceWidth));
    const sHeight = Math.max(10, Math.min(sourceHeight - sy, rawH * sourceHeight));

    // High quality dimension for vision models
    const maxDimension = 1024;
    let targetWidth = sWidth;
    let targetHeight = sHeight;

    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      if (targetWidth > targetHeight) {
        targetHeight = (targetHeight * maxDimension) / targetWidth;
        targetWidth = maxDimension;
      } else {
        targetWidth = (targetWidth * maxDimension) / targetHeight;
        targetHeight = maxDimension;
      }
    }

    canvas.width = Math.round(targetWidth);
    canvas.height = Math.round(targetHeight);

    ctx.drawImage(source, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  /**
   * Helper to parse JSON from AI responses safely (handles markdown code fences and trailing text)
   */
  private safeParseJSON(raw: string): any {
    if (!raw || typeof raw !== 'string') return {};
    const clean = raw.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          // parse failed
        }
      }
    }
    return { label: clean.slice(0, 60).trim(), has_object: true };
  }

  /**
   * Step 1: High-Precision Vision-Language Model Identification
   * Prioritizes: Backend -> Mistral Pixtral -> Claude 3.5 Sonnet -> Gemini -> GPT-4o -> Groq -> Fallback
   */
  public async identifyObject(
    imageBase64: string,
    mode: 'HOLDING' | 'LOOKING_AT',
    hintQuery?: string
  ): Promise<VLMIdentificationResult> {
    const hasCustomClientKeys = Boolean(
      this.mistralApiKey || this.anthropicApiKey || this.geminiApiKey || this.openaiApiKey || this.groqApiKey
    );

    // 1. Try Python Backend endpoint (passes custom client keys if configured)
    try {
      const res = await fetch(`${this.backendUrl}/api/identify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.mistralApiKey ? { 'X-Mistral-Key': this.mistralApiKey } : {}),
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          mode: mode,
          user_query: hintQuery,
          mistral_api_key: this.mistralApiKey,
          anthropic_api_key: this.anthropicApiKey,
          gemini_api_key: this.geminiApiKey,
          openai_api_key: this.openaiApiKey,
          groq_api_key: this.groqApiKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const isBackendFallback =
          data.fallback === true ||
          (data.provider && data.provider.toLowerCase().includes('fallback'));

        // If backend produced a real identification (or if client has no custom keys), use it!
        if (data.label && (!isBackendFallback || !hasCustomClientKeys)) {
          const isNoObj = data.has_object === false || data.label.toLowerCase().includes('no object');
          return {
            hasObject: !isNoObj,
            label: isNoObj ? 'No Object Detected' : data.label,
            confidence: data.confidence || 'high',
            search_query: isNoObj ? '' : (data.search_query || data.label),
            provider: data.provider || 'Backend VLM',
          };
        }
      }
    } catch {
      // Proceed to client-side direct calls
    }

    // 2. Direct client-side Mistral Pixtral (Primary Model)
    if (this.mistralApiKey && this.mistralApiKey.trim() !== '') {
      try {
        return await this.callMistralPixtralDirect(imageBase64, mode, hintQuery);
      } catch (err) {
        console.warn('Direct Mistral Pixtral call failed:', err);
      }
    }

    // 3. Direct client-side Anthropic Claude 3.5 Sonnet (Fallback)
    if (this.anthropicApiKey && this.anthropicApiKey.trim() !== '') {
      try {
        return await this.callAnthropicClaudeDirect(imageBase64, mode, hintQuery);
      } catch (err) {
        console.warn('Direct Anthropic Claude call failed:', err);
      }
    }

    // 4. Direct client-side Gemini 1.5/2.0 Flash
    if (this.geminiApiKey && this.geminiApiKey.trim() !== '') {
      try {
        return await this.callGeminiDirect(imageBase64, mode, hintQuery);
      } catch (err) {
        console.warn('Direct Gemini call failed:', err);
      }
    }

    // 5. Direct client-side OpenAI GPT-4o
    if (this.openaiApiKey && this.openaiApiKey.trim() !== '') {
      try {
        return await this.callOpenAIDirect(imageBase64, mode, hintQuery);
      } catch (err) {
        console.warn('Direct OpenAI GPT-4o call failed:', err);
      }
    }

    // 6. Direct client-side Groq Llama 3.2 Vision
    if (this.groqApiKey && this.groqApiKey.trim() !== '') {
      try {
        return await this.callGroqVisionDirect(imageBase64, mode, hintQuery);
      } catch (err) {
        console.warn('Direct Groq Vision call failed:', err);
      }
    }

    // 7. Fallback classifier
    return this.runSmartFallbackIdentification(mode, hintQuery);
  }

  /**
   * Step 2: RAG Grounding Calm Narrator Generator
   * Prioritizes Mistral AI for calm, articulate speech synthesis
   */
  public async generateCalmNarratorAnswer(
    label: string,
    wikiSummary: WikipediaSummary
  ): Promise<{ shortAnswer: string; expandedText: string }> {
    // If no object was detected, return a brief clear response
    if (label.toLowerCase().includes('no object') || !wikiSummary.extract) {
      return {
        shortAnswer: 'No distinct object was detected in your hand or framed view.',
        expandedText: 'Please place or hold an object clearly in view of the camera to identify it.',
      };
    }

    // 1. Mistral AI Calm Narrator Generation
    if (this.mistralApiKey && this.mistralApiKey.trim() !== '') {
      try {
        const prompt = `You are a calm, articulate narrator for a pair of high-end AR smart glasses.
The user is looking at: "${label}".
Grounding reference from Wikipedia:
"${wikiSummary.extract}"

Generate:
1. "shortAnswer": 2 to 3 calm, concise sentences explaining what this is, how it works or its significance. No filler words, no conversational fluff. Direct like a high-end museum audio guide.
2. "expandedText": The refined 1-2 paragraph encyclopedic overview for the AR card.

Respond in strict JSON:
{
  "shortAnswer": "...",
  "expandedText": "..."
}`;

        const models = ['mistral-small-latest', 'ministral-8b-latest', 'mistral-large-latest'];
        for (const model of models) {
          try {
            const res = await this.fetchWithProxyFallback(
              '/api/mistral-proxy/v1/chat/completions',
              'https://api.mistral.ai/v1/chat/completions',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${this.mistralApiKey}`,
                },
                body: JSON.stringify({
                  model: model,
                  response_format: { type: 'json_object' },
                  messages: [{ role: 'user', content: prompt }],
                }),
              }
            );

            if (res.ok) {
              const data = await res.json();
              const raw = data.choices?.[0]?.message?.content || '';
              const parsed = this.safeParseJSON(raw);
              const shortAnswer = parsed.shortAnswer || parsed.short_answer;
              const expandedText = parsed.expandedText || parsed.expanded_text;
              if (shortAnswer) {
                return {
                  shortAnswer: shortAnswer,
                  expandedText: expandedText || wikiSummary.extract,
                };
              }
            }
          } catch {
            // try next model
          }
        }
      } catch (e) {
        console.warn('Mistral narrator synthesis error:', e);
      }
    }

    // 2. Anthropic Claude Fallback
    if (this.anthropicApiKey && this.anthropicApiKey.trim() !== '') {
      try {
        const prompt = `You are a calm, articulate narrator for a pair of high-end AR smart glasses.
The user is looking at: "${label}".
Grounding reference from Wikipedia:
"${wikiSummary.extract}"

Generate:
1. "shortAnswer": 2 to 4 calm, concise sentences explaining what this is, how it works or its significance. No filler words, no "Sure!", no conversational fluff. Direct like a high-end museum audio guide.
2. "expandedText": The refined 1-2 paragraph encyclopedic overview for the AR card.

Respond in strict JSON:
{
  "shortAnswer": "...",
  "expandedText": "..."
}`;

        const res = await this.fetchWithProxyFallback(
          '/api/anthropic-proxy/v1/messages',
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.anthropicApiKey,
              'anthropic-version': '2023-06-01',
              'dangerously-allow-browser': 'true',
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 400,
              messages: [{ role: 'user', content: prompt }],
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const raw = data.content?.[0]?.text || '';
          const parsed = this.safeParseJSON(raw);
          const shortAnswer = parsed.shortAnswer || parsed.short_answer;
          const expandedText = parsed.expandedText || parsed.expanded_text;
          if (shortAnswer) {
            return {
              shortAnswer: shortAnswer,
              expandedText: expandedText || wikiSummary.extract,
            };
          }
        }
      } catch (e) {
        console.warn('Anthropic narrator synthesis error:', e);
      }
    }

    const sentences = wikiSummary.extract.match(/[^.!?]+[.!?]+/g) || [wikiSummary.extract];
    const shortSentences = sentences.slice(0, 3).join(' ').trim();

    return {
      shortAnswer: shortSentences || `${label} is identified in your field of view.`,
      expandedText: wikiSummary.extract,
    };
  }

  /**
   * Universal VLM Output Parser — resilient against key variations and format quirks
   */
  private parseClientVLMResult(parsed: any, provider: string): VLMIdentificationResult {
    if (!parsed || typeof parsed !== 'object') {
      return {
        hasObject: false,
        label: 'No Object Detected',
        confidence: 'high',
        search_query: '',
        provider,
      };
    }

    // Extract object name from any potential property key returned by the model
    const rawLabel = (
      parsed.label ||
      parsed.object ||
      parsed.item ||
      parsed.name ||
      parsed.class ||
      parsed.primary_object ||
      parsed.detected_object ||
      parsed.title ||
      parsed.subject ||
      parsed.category ||
      ''
    ).toString().trim();

    const normalized = rawLabel.toLowerCase();

    // Exact phrases indicating no object (NEVER match substrings like 'none' or 'empty' inside 'iPhone' or 'empty mug')
    const explicitNoObjPhrases = [
      'no object detected',
      'no object',
      'no item detected',
      'no item',
      'nothing detected',
      'empty hand',
      'bare hand',
      'empty palm',
      'empty frame',
      'background only',
      'none',
      'nothing',
      'unidentified',
      'null',
    ];

    let isExplicitNoObj = false;
    if (!rawLabel) {
      isExplicitNoObj = true;
    } else if (
      explicitNoObjPhrases.includes(normalized) ||
      normalized.startsWith('no object') ||
      normalized.startsWith('no item') ||
      normalized.startsWith('empty hand') ||
      normalized.startsWith('bare hand') ||
      normalized.startsWith('nothing detected')
    ) {
      isExplicitNoObj = true;
    } else if (
      (parsed.has_object === false || parsed.hasObject === false) &&
      (normalized === 'hand' || normalized === 'palm' || normalized === 'background' || normalized === 'empty')
    ) {
      isExplicitNoObj = true;
    }

    const searchQuery = isExplicitNoObj
      ? ''
      : (
          parsed.search_query ||
          parsed.searchQuery ||
          parsed.wiki_title ||
          parsed.wikipedia_title ||
          rawLabel ||
          'Object'
        ).toString().trim();

    return {
      hasObject: !isExplicitNoObj,
      label: isExplicitNoObj ? 'No Object Detected' : rawLabel,
      confidence: parsed.confidence || 'high',
      search_query: searchQuery,
      provider: provider,
    };
  }

  // --- Direct Mistral Pixtral Call ---
  private async callMistralPixtralDirect(
    imageBase64: string,
    mode: 'HOLDING' | 'LOOKING_AT',
    hintQuery?: string
  ): Promise<VLMIdentificationResult> {
    const rawB64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const modeContext =
      mode === 'HOLDING'
        ? 'The user is holding or presenting a physical object in front of the camera.'
        : 'The user has framed an object or scene in their environment.';

    const systemPrompt = `You are the visual cortex for AR Smart Glasses. ${modeContext}
Task: Accurately identify the main physical object, device, item, or subject shown in this image.

Instructions:
1. Accurately name the specific object or category (e.g. Smartphone, Coffee Mug, Laptop, Wristwatch, Pen, Water Bottle, Book, Plant, Monitor, Eyeglasses, Keyboard, Backpack, Apple, Headphones).
2. If the user query is specific ("${hintQuery || ''}"), include the requested brand, model, or characteristic.
3. Only if the view is purely a bare empty hand with no item or a totally empty blank background, return has_object: false and label: 'No Object Detected'.

Format response STRICTLY as JSON:
{
  "has_object": true,
  "label": "Primary object name",
  "confidence": "high",
  "search_query": "Wikipedia article title for this object"
}`;

    // Candidate Pixtral models in order of capability
    const candidateModels = ['pixtral-12b-2409', 'pixtral-large-latest', 'pixtral-12b'];
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const payload = {
          model: model,
          response_format: { type: 'json_object' },
          temperature: 0.1,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `${systemPrompt}\n\nUser request: ${hintQuery || 'Identify the primary object in this framed view.'}`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,{rawB64}`.replace('{rawB64}', rawB64),
                  },
                },
              ],
            },
          ],
        };

        const response = await this.fetchWithProxyFallback(
          '/api/mistral-proxy/v1/chat/completions',
          'https://api.mistral.ai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.mistralApiKey}`,
            },
            body: JSON.stringify(payload),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawContent = data.choices?.[0]?.message?.content || '{}';
          const parsed = this.safeParseJSON(rawContent);
          return this.parseClientVLMResult(parsed, `Mistral ${model}`);
        } else {
          const errText = await response.text();
          lastError = new Error(`Mistral (${model}) HTTP ${response.status}: ${errText}`);
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('Mistral Pixtral identification failed across all candidate models');
  }

  // --- Direct Anthropic Claude Call ---
  private async callAnthropicClaudeDirect(
    imageBase64: string,
    mode: 'HOLDING' | 'LOOKING_AT',
    hintQuery?: string
  ): Promise<VLMIdentificationResult> {
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const modeContext =
      mode === 'HOLDING'
        ? 'The user is holding or presenting an object in front of the camera.'
        : 'The user has framed an object or scene in their environment.';

    const systemPrompt = `You are the visual cortex for AR Smart Glasses. ${modeContext}
Task: Identify the primary physical object, device, item, or subject shown in the image.

Guidelines:
1. Identify the general category/class name (e.g. Smartphone, Coffee Mug, Laptop, Pen, Wristwatch, Water Bottle, Book, Plant, Glasses, Keyboard, Chair, Monitor).
2. If the user query is specific ("${hintQuery || ''}"), include relevant details.
3. If strictly a completely bare open hand or blank background with nothing present, return has_object: false.

Return strictly valid JSON:
{
  "has_object": true,
  "label": "Primary object class name",
  "confidence": "high",
  "search_query": "Standard Wikipedia article title"
}`;

    const response = await this.fetchWithProxyFallback(
      '/api/anthropic-proxy/v1/messages',
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 250,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: base64Data,
                  },
                },
                {
                  type: 'text',
                  text: hintQuery || 'Identify the primary object in this framed view.',
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) throw new Error(`Anthropic API status: ${response.status}`);
    const data = await response.json();
    const raw = data.content?.[0]?.text || '';
    const parsed = this.safeParseJSON(raw);

    return this.parseClientVLMResult(parsed, 'Claude 3.5 Sonnet');
  }

  // --- Direct Gemini Call ---
  private async callGeminiDirect(
    imageBase64: string,
    _mode: 'HOLDING' | 'LOOKING_AT',
    hintQuery?: string
  ): Promise<VLMIdentificationResult> {
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const prompt = `You are AR Smart Glasses visual AI.
RULES:
1. NO OBJECT: If hand is empty, return "has_object": false, "label": "No Object Detected", "search_query": "".
2. CLASS LEVEL: Predict general class (Mobile Phone, Laptop, Wristwatch, Plant).
3. Return confidence: "high".

Return strictly valid JSON:
{
  "has_object": true,
  "label": "General class name OR 'No Object Detected'",
  "confidence": "high",
  "search_query": "Standard Wikipedia article title"
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt + '\n' + (hintQuery || 'Identify object or detect empty hand.') },
              { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) throw new Error(`Gemini API status: ${response.status}`);
    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = this.safeParseJSON(raw);

    return this.parseClientVLMResult(parsed, 'Gemini 1.5 Flash');
  }

  // --- Direct OpenAI Call ---
  private async callOpenAIDirect(
    imageBase64: string,
    _mode: 'HOLDING' | 'LOOKING_AT',
    hintQuery?: string
  ): Promise<VLMIdentificationResult> {
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const systemPrompt = `You are AR Smart Glasses visual AI.
RULES:
1. NO OBJECT: If hand is empty or no item is held, return { "has_object": false, "label": "No Object Detected", "confidence": "high", "search_query": "" }
2. CLASS LEVEL: Predict general class (Mobile Phone, Laptop, Wristwatch, Plant).
3. Return confidence: "high".`;

    const response = await this.fetchWithProxyFallback(
      '/api/openai-proxy/v1/chat/completions',
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: hintQuery || 'Identify object or detect empty hand.' },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) throw new Error(`OpenAI status: ${response.status}`);
    const data = await response.json();
    const parsed = this.safeParseJSON(data.choices?.[0]?.message?.content || '{}');

    return this.parseClientVLMResult(parsed, 'GPT-4o');
  }

  // --- Direct Groq Vision Call ---
  private async callGroqVisionDirect(
    imageBase64: string,
    _mode: 'HOLDING' | 'LOOKING_AT',
    hintQuery?: string
  ): Promise<VLMIdentificationResult> {
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const systemPrompt = `You are AR Smart Glasses visual AI.
RULES:
1. NO OBJECT: If hand is empty or no item is held, return { "has_object": false, "label": "No Object Detected", "confidence": "high", "search_query": "" }
2. CLASS LEVEL: Predict general class (Mobile Phone, Laptop, Wristwatch, Plant).
3. Return confidence: "high".`;

    const response = await this.fetchWithProxyFallback(
      '/api/groq-proxy/openai/v1/chat/completions',
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.groqApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.2-90b-vision-preview',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: hintQuery || 'Identify this object class or detect empty hand.' },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) throw new Error(`Groq status: ${response.status}`);
    const data = await response.json();
    const parsed = this.safeParseJSON(data.choices?.[0]?.message?.content || '{}');

    return this.parseClientVLMResult(parsed, 'Groq Llama 3.2 Vision');
  }

  private runSmartFallbackIdentification(
    _mode: 'HOLDING' | 'LOOKING_AT',
    hintQuery?: string
  ): VLMIdentificationResult {
    const catalog: VLMIdentificationResult[] = [
      { hasObject: true, label: 'Mobile Phone', confidence: 'high', search_query: 'Mobile phone', provider: 'Smart Knowledge' },
      { hasObject: true, label: 'Laptop', confidence: 'high', search_query: 'Laptop', provider: 'Smart Knowledge' },
      { hasObject: true, label: 'Wristwatch', confidence: 'high', search_query: 'Watch', provider: 'Smart Knowledge' },
      { hasObject: true, label: 'Houseplant', confidence: 'high', search_query: 'Houseplant', provider: 'Smart Knowledge' },
      { hasObject: true, label: 'Coffee Mug', confidence: 'high', search_query: 'Coffee cup', provider: 'Smart Knowledge' },
      { hasObject: true, label: 'Headphones', confidence: 'high', search_query: 'Headphones', provider: 'Smart Knowledge' },
      { hasObject: true, label: 'Water Bottle', confidence: 'high', search_query: 'Water bottle', provider: 'Smart Knowledge' },
    ];

    if (hintQuery) {
      if (hintQuery.toLowerCase().includes('no object') || hintQuery.toLowerCase().includes('empty')) {
        return { hasObject: false, label: 'No Object Detected', confidence: 'high', search_query: '', provider: 'Smart Knowledge' };
      }
      const match = catalog.find(
        (item) =>
          item.label.toLowerCase().includes(hintQuery.toLowerCase()) ||
          item.search_query.toLowerCase().includes(hintQuery.toLowerCase())
      );
      if (match) return match;
    }

    return {
      hasObject: false,
      label: 'No Object Detected',
      confidence: 'high',
      search_query: '',
      provider: 'Smart Knowledge Fallback',
    };
  }
}

export const vlmService = new VLMService();
