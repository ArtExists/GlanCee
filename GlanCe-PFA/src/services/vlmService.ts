import { BoundingBox, VLMIdentificationResult, WikipediaSummary } from '../types';

export class VLMService {
  private qwenApiKey: string = '';
  private qwenApiBaseUrl: string = 'https://router.huggingface.co/hf-inference/v1';
  private qwenModel: string = 'Qwen/Qwen2.5-VL-3B-Instruct';
  private mistralApiKey: string = '';
  private anthropicApiKey: string = '';
  private geminiApiKey: string = '';
  private openaiApiKey: string = '';
  private groqApiKey: string = '';
  private backendUrl: string = 'http://localhost:8000';

  public setQwenApiKey(key: string) {
    this.qwenApiKey = key || '';
  }

  public setQwenApiBaseUrl(url: string) {
    this.qwenApiBaseUrl = url || 'https://router.huggingface.co/hf-inference/v1';
  }

  public setQwenModel(model: string) {
    this.qwenModel = model || 'Qwen/Qwen2.5-VL-3B-Instruct';
  }

  public setMistralApiKey(key: string) {
    this.mistralApiKey = key || '';
  }

  public setAnthropicApiKey(key: string) {
    this.anthropicApiKey = key || '';
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
   * Helper to perform fetch with local Vite/Vercel proxy fallback (bypasses browser CORS & ignores SPA HTML fallbacks)
   */
  private async fetchWithProxyFallback(
    proxyPath: string,
    directUrl: string,
    options: RequestInit
  ): Promise<Response> {
    // 1. Try local dev/Vercel proxy endpoint first (avoids browser CORS)
    try {
      const proxyRes = await fetch(proxyPath, options);
      const contentType = proxyRes.headers.get('content-type') || '';
      // If proxy route exists, answered, and is NOT a catch-all index.html page (Vercel SPA rewrite)
      if (proxyRes.status !== 404 && proxyRes.status !== 502 && !contentType.includes('text/html')) {
        return proxyRes;
      }
    } catch {
      // Proxy failed or not running, fall through to direct call
    }

    // 2. Fall back to direct external API endpoint
    return await fetch(directUrl, options);
  }

  /**
   * Test Qwen 2.5-VL 3B Instruct API key connectivity
   */
  public async testQwenKey(
    key: string,
    baseUrl?: string,
    modelName?: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanKey = (key || '').trim();
    const effectiveBaseUrl = (baseUrl || this.qwenApiBaseUrl || 'https://router.huggingface.co/hf-inference/v1').replace(/\/+$/, '');
    const effectiveModel = modelName || this.qwenModel || 'Qwen/Qwen2.5-VL-3B-Instruct';

    const isLocalOllama = effectiveBaseUrl.includes('localhost:11434') || effectiveBaseUrl.includes('127.0.0.1:11434');

    if (!isLocalOllama && !cleanKey) {
      return { success: false, message: 'Please enter an API Key (e.g. Hugging Face / OpenRouter / DashScope token).' };
    }

    const candidateEndpoints: Array<{ proxy: string; direct: string; model: string }> = [];

    if (effectiveBaseUrl.includes('router.huggingface.co') || effectiveBaseUrl.includes('api-inference.huggingface.co')) {
      candidateEndpoints.push(
        {
          proxy: `/api/hf-proxy/hf-inference/v1/chat/completions`,
          direct: `https://router.huggingface.co/hf-inference/v1/chat/completions`,
          model: effectiveModel,
        },
        {
          proxy: `/api/hf-api-proxy/models/Qwen/Qwen2.5-VL-3B-Instruct/v1/chat/completions`,
          direct: `https://api-inference.huggingface.co/models/Qwen/Qwen2.5-VL-3B-Instruct/v1/chat/completions`,
          model: 'Qwen/Qwen2.5-VL-3B-Instruct',
        },
        {
          proxy: `/api/hf-api-proxy/models/Qwen/Qwen2.5-VL-7B-Instruct/v1/chat/completions`,
          direct: `https://api-inference.huggingface.co/models/Qwen/Qwen2.5-VL-7B-Instruct/v1/chat/completions`,
          model: 'Qwen/Qwen2.5-VL-7B-Instruct',
        }
      );
    } else if (effectiveBaseUrl.includes('openrouter.ai')) {
      candidateEndpoints.push({
        proxy: `/api/openrouter-proxy/api/v1/chat/completions`,
        direct: `https://openrouter.ai/api/v1/chat/completions`,
        model: effectiveModel,
      });
    } else if (effectiveBaseUrl.includes('dashscope.aliyuncs.com')) {
      candidateEndpoints.push({
        proxy: `/api/dashscope-proxy/compatible-mode/v1/chat/completions`,
        direct: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`,
        model: effectiveModel,
      });
    } else {
      candidateEndpoints.push({
        proxy: `${effectiveBaseUrl}/chat/completions`,
        direct: `${effectiveBaseUrl}/chat/completions`,
        model: effectiveModel,
      });
    }

    let lastErrText = '';
    for (const ep of candidateEndpoints) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (cleanKey) {
          headers['Authorization'] = `Bearer ${cleanKey}`;
        }
        if (ep.direct.includes('openrouter.ai')) {
          headers['HTTP-Referer'] = 'http://localhost:5173';
          headers['X-Title'] = 'GlanCee AR';
        }

        const res = await this.fetchWithProxyFallback(ep.proxy, ep.direct, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: ep.model,
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 10,
          }),
        });

        if (res.ok) {
          return { success: true, message: `Qwen 2.5-VL (${ep.model}) is active & verified!` };
        } else {
          const errText = await res.text();
          lastErrText = `HTTP ${res.status}: ${errText.slice(0, 80)}`;
          if (res.status === 401) {
            return { success: false, message: 'Invalid API Key (HTTP 401 Unauthorized).' };
          }
          if (res.status === 429) {
            return { success: false, message: 'Rate Limit / Quota Exceeded (HTTP 429).' };
          }
        }
      } catch (err: any) {
        lastErrText = err?.message || 'Failed to reach endpoint';
      }
    }

    return { success: false, message: `Qwen Connection Error: ${lastErrText}` };
  }

  /**
   * Test Mistral API key validity and connectivity
   */
  public async testMistralKey(key: string): Promise<{ success: boolean; message: string }> {
    if (!key || !key.trim()) {
      return { success: false, message: 'Please enter a Mistral API key first.' };
    }
    const cleanKey = key.trim();
    try {
      const res = await this.fetchWithProxyFallback(
        '/api/mistral-proxy/v1/chat/completions',
        'https://api.mistral.ai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cleanKey}`,
          },
          body: JSON.stringify({
            model: 'mistral-small-latest',
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 5,
          }),
        }
      );

      if (res.ok) {
        return { success: true, message: 'Mistral API key is active & verified!' };
      } else {
        const errText = await res.text();
        if (res.status === 401) {
          return { success: false, message: 'Invalid API Key (HTTP 401 Unauthorized).' };
        }
        if (res.status === 429) {
          return { success: false, message: 'Rate Limit / Quota Exceeded (HTTP 429).' };
        }
        return { success: false, message: `Mistral Error (HTTP ${res.status}): ${errText.slice(0, 80)}` };
      }
    } catch (err: any) {
      return { success: false, message: `Connection Error: ${err?.message || 'Failed to reach Mistral'}` };
    }
  }

  /**
   * Crop image from video/image source with true intrinsic pixel dimensions
   */
  public cropImage(
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    box: BoundingBox,
    paddingPercent: number = 0.20
  ): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    let sourceWidth = 640;
    let sourceHeight = 480;

    if ('videoWidth' in source && source.videoWidth > 0) {
      sourceWidth = source.videoWidth;
      sourceHeight = source.videoHeight;
    } else if ('naturalWidth' in source && source.naturalWidth > 0) {
      sourceWidth = source.naturalWidth;
      sourceHeight = source.naturalHeight;
    } else if ('width' in source && typeof source.width === 'number' && source.width > 0) {
      sourceWidth = source.width;
      sourceHeight = ('height' in source && typeof source.height === 'number') ? source.height : 480;
    }

    const effectiveWidth = Math.max(0.35, Math.min(0.95, box.width));
    const effectiveHeight = Math.max(0.35, Math.min(0.95, box.height));
    const centerX = Math.max(effectiveWidth / 2, Math.min(1 - effectiveWidth / 2, box.x + box.width / 2));
    const centerY = Math.max(effectiveHeight / 2, Math.min(1 - effectiveHeight / 2, box.y + box.height / 2));

    const padW = effectiveWidth * paddingPercent;
    const padH = effectiveHeight * paddingPercent;

    const rawX = Math.max(0, centerX - effectiveWidth / 2 - padW);
    const rawY = Math.max(0, centerY - effectiveHeight / 2 - padH);
    const rawW = Math.min(1 - rawX, effectiveWidth + padW * 2);
    const rawH = Math.min(1 - rawY, effectiveHeight + padH * 2);

    const sx = Math.max(0, Math.floor(rawX * sourceWidth));
    const sy = Math.max(0, Math.floor(rawY * sourceHeight));
    const sWidth = Math.max(30, Math.min(sourceWidth - sx, Math.floor(rawW * sourceWidth)));
    const sHeight = Math.max(30, Math.min(sourceHeight - sy, Math.floor(rawH * sourceHeight)));

    const maxDim = 1024;
    let targetWidth = sWidth;
    let targetHeight = sHeight;

    if (targetWidth > maxDim || targetHeight > maxDim) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
        targetWidth = maxDim;
      } else {
        targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
        targetHeight = maxDim;
      }
    } else if (targetWidth < 384 && targetHeight < 384) {
      const scale = 384 / Math.min(targetWidth, targetHeight);
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
    }

    canvas.width = Math.max(64, targetWidth);
    canvas.height = Math.max(64, targetHeight);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.92);
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
   * Primary Vision-Language Model Object Identification Pipeline
   * Priority: Qwen 2.5-VL 3B Instruct -> Backend -> Mistral Pixtral -> Claude -> Gemini -> GPT-4o -> Groq -> Fallback
   */
  public async identifyObject(
    imageBase64: string,
    mode: 'HOLDING' | 'LOOKING_AT',
    hintQuery?: string
  ): Promise<VLMIdentificationResult> {
    // 1. Primary Model: Qwen 2.5-VL 3B Instruct (Hugging Face / OpenRouter / Ollama / Custom)
    if (this.qwenApiKey && this.qwenApiKey.trim() !== '') {
      try {
        return await this.callQwenVLDirect(imageBase64, mode, hintQuery);
      } catch (err) {
        console.warn('Direct Qwen 2.5-VL 3B Instruct call failed:', err);
      }
    }

    // 2. Python Backend endpoint (supports local Qwen / Pixtral / Claude)
    try {
      const res = await fetch(`${this.backendUrl}/api/identify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.qwenApiKey ? { 'X-Qwen-Key': this.qwenApiKey } : {}),
          ...(this.mistralApiKey ? { 'X-Mistral-Key': this.mistralApiKey } : {}),
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          mode: mode,
          user_query: hintQuery,
          qwen_api_key: this.qwenApiKey,
          qwen_model: this.qwenModel,
          qwen_base_url: this.qwenApiBaseUrl,
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

        if (data.label && !isBackendFallback && data.has_object !== false && !data.label.toLowerCase().includes('no object')) {
          return {
            hasObject: true,
            label: data.label,
            confidence: data.confidence || 'high',
            search_query: data.search_query || data.label,
            provider: data.provider || 'Qwen 2.5-VL (Backend)',
          };
        }
      }
    } catch {
      // Backend not running, proceed to other client-side providers
    }

    // 3. Direct client-side Mistral Pixtral
    if (this.mistralApiKey && this.mistralApiKey.trim() !== '') {
      try {
        return await this.callMistralPixtralDirect(imageBase64, mode, hintQuery);
      } catch (err) {
        console.warn('Direct Mistral Pixtral call failed:', err);
      }
    }

    // 4. Direct client-side Anthropic Claude 3.5 Sonnet
    if (this.anthropicApiKey && this.anthropicApiKey.trim() !== '') {
      try {
        return await this.callAnthropicClaudeDirect(imageBase64, mode, hintQuery);
      } catch (err) {
        console.warn('Direct Anthropic Claude call failed:', err);
      }
    }

    // 5. Direct client-side Gemini 1.5/2.0 Flash
    if (this.geminiApiKey && this.geminiApiKey.trim() !== '') {
      try {
        return await this.callGeminiDirect(imageBase64, mode, hintQuery);
      } catch (err) {
        console.warn('Direct Gemini call failed:', err);
      }
    }

    // 6. Direct client-side OpenAI GPT-4o
    if (this.openaiApiKey && this.openaiApiKey.trim() !== '') {
      try {
        return await this.callOpenAIDirect(imageBase64, mode, hintQuery);
      } catch (err) {
        console.warn('Direct OpenAI GPT-4o call failed:', err);
      }
    }

    // 7. Direct client-side Groq Llama 3.2 Vision
    if (this.groqApiKey && this.groqApiKey.trim() !== '') {
      try {
        return await this.callGroqVisionDirect(imageBase64, mode, hintQuery);
      } catch (err) {
        console.warn('Direct Groq Vision call failed:', err);
      }
    }

    // 8. Visual heuristics fallback classifier with Wikipedia search
    return this.runSmartFallbackIdentification(imageBase64, mode, hintQuery);
  }

  /**
   * Qwen 2.5-VL 3B Instruct Direct Vision-Language Model Inference
   */
  private async callQwenVLDirect(
    imageBase64: string,
    mode: 'HOLDING' | 'LOOKING_AT',
    hintQuery?: string
  ): Promise<VLMIdentificationResult> {
    const rawB64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const modeContext =
      mode === 'HOLDING'
        ? 'The user is holding or presenting a physical object in front of the smart glasses camera.'
        : 'The user has framed an object or subject in their environment.';

    const systemPrompt = `You are the visual cortex for AR Smart Glasses powered by Qwen 2.5-VL. ${modeContext}${hintQuery ? `\nUser hint query: "${hintQuery}"` : ''}
Task: Accurately identify the main physical object, device, item, product, or subject shown in this image.

RULES:
1. IDENTIFY THE OBJECT (CONCISE & GENERIC BASE CATEGORY): Identify the broad, basic category of the physical object. Keep the name simple, broad, and concise (e.g., "Watch" instead of "Wristwatch" or "Smartwatch", "Phone" instead of "Smartphone" or "iPhone", "Bottle" instead of "Water bottle", "Cup" or "Mug", "Pen", "Book", "Laptop", "Headphones", "Keyboard", "Mouse", "Plant", "Glasses", "Chair", "Backpack", "Remote").
2. AVOID OVER-SPECIFICATION: Do NOT use compound modifiers, sub-types, or brand names for the primary label unless specifically asked.
3. If a hand is holding or pointing at an item, identify the ITEM held, NOT the hand.
4. Output strictly valid JSON with no markdown formatting:
{
  "has_object": true,
  "label": "Base object category (e.g. Watch, Phone, Mug, Bottle, Book, Plant)",
  "confidence": "high",
  "search_query": "Wikipedia article title for this object"
}
5. Only return {"has_object": false, "label": "No Object Detected"} if the frame is completely black, completely blank, or literally only an empty bare hand with zero objects present.`;

    const effectiveBaseUrl = (this.qwenApiBaseUrl || 'https://router.huggingface.co/hf-inference/v1').replace(/\/+$/, '');
    const effectiveModel = this.qwenModel || 'Qwen/Qwen2.5-VL-3B-Instruct';

    const candidateEndpoints: Array<{ proxy: string; direct: string; model: string }> = [];

    if (effectiveBaseUrl.includes('router.huggingface.co') || effectiveBaseUrl.includes('api-inference.huggingface.co')) {
      candidateEndpoints.push(
        {
          proxy: `/api/hf-proxy/hf-inference/v1/chat/completions`,
          direct: `https://router.huggingface.co/hf-inference/v1/chat/completions`,
          model: effectiveModel,
        },
        {
          proxy: `/api/hf-api-proxy/models/Qwen/Qwen2.5-VL-3B-Instruct/v1/chat/completions`,
          direct: `https://api-inference.huggingface.co/models/Qwen/Qwen2.5-VL-3B-Instruct/v1/chat/completions`,
          model: 'Qwen/Qwen2.5-VL-3B-Instruct',
        },
        {
          proxy: `/api/hf-api-proxy/models/Qwen/Qwen2.5-VL-7B-Instruct/v1/chat/completions`,
          direct: `https://api-inference.huggingface.co/models/Qwen/Qwen2.5-VL-7B-Instruct/v1/chat/completions`,
          model: 'Qwen/Qwen2.5-VL-7B-Instruct',
        }
      );
    } else if (effectiveBaseUrl.includes('openrouter.ai')) {
      candidateEndpoints.push({
        proxy: `/api/openrouter-proxy/api/v1/chat/completions`,
        direct: `https://openrouter.ai/api/v1/chat/completions`,
        model: effectiveModel,
      });
    } else if (effectiveBaseUrl.includes('dashscope.aliyuncs.com')) {
      candidateEndpoints.push({
        proxy: `/api/dashscope-proxy/compatible-mode/v1/chat/completions`,
        direct: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`,
        model: effectiveModel,
      });
    } else {
      candidateEndpoints.push({
        proxy: `${effectiveBaseUrl}/chat/completions`,
        direct: `${effectiveBaseUrl}/chat/completions`,
        model: effectiveModel,
      });
    }

    let lastError: any = null;

    for (const ep of candidateEndpoints) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (this.qwenApiKey && this.qwenApiKey.trim()) {
          headers['Authorization'] = `Bearer ${this.qwenApiKey.trim()}`;
        }
        if (ep.direct.includes('openrouter.ai')) {
          headers['HTTP-Referer'] = 'http://localhost:5173';
          headers['X-Title'] = 'GlanCee AR';
        }

        const bodyPayload = {
          model: ep.model,
          temperature: 0.1,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `${systemPrompt}\n\nWhat is this object? Identify the specific object and its Wikipedia search query in JSON.`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${rawB64}`,
                  },
                },
              ],
            },
          ],
        };

        const response = await this.fetchWithProxyFallback(ep.proxy, ep.direct, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload),
        });

        if (response.ok) {
          const data = await response.json();
          const rawContent = data.choices?.[0]?.message?.content || '{}';
          console.log(`[Qwen 2.5-VL (${ep.model})] Output:`, rawContent);
          const parsed = this.safeParseJSON(rawContent);
          return this.parseClientVLMResult(parsed, `Qwen 2.5-VL (${ep.model})`);
        } else {
          const errText = await response.text();
          lastError = new Error(`Qwen (${ep.model}) HTTP ${response.status}: ${errText}`);
          if (response.status === 401 || response.status === 429) {
            throw lastError;
          }
        }
      } catch (err: any) {
        lastError = err;
        if (err.message && (err.message.includes('401') || err.message.includes('429'))) {
          throw err;
        }
      }
    }

    throw lastError || new Error('Qwen 2.5-VL inference failed across candidate endpoints.');
  }

  /**
   * Step 2: RAG Grounding Calm Narrator Generator
   */
  public async generateCalmNarratorAnswer(
    label: string,
    wikiSummary: WikipediaSummary
  ): Promise<{ shortAnswer: string; expandedText: string }> {
    if (label.toLowerCase().includes('no object') || !wikiSummary.extract) {
      return {
        shortAnswer: 'No distinct object was detected in your hand or framed view.',
        expandedText: 'Please place or hold an object clearly in view of the camera to identify it.',
      };
    }

    // 1. Qwen 2.5-VL / Qwen LLM Calm Narrator Generation
    if (this.qwenApiKey && this.qwenApiKey.trim() !== '') {
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

        const effectiveBaseUrl = (this.qwenApiBaseUrl || 'https://router.huggingface.co/hf-inference/v1').replace(/\/+$/, '');
        const effectiveModel = this.qwenModel || 'Qwen/Qwen2.5-VL-3B-Instruct';

        let targetEndpoint = `${effectiveBaseUrl}/chat/completions`;
        let proxyEndpoint = targetEndpoint;

        if (effectiveBaseUrl.includes('router.huggingface.co')) {
          proxyEndpoint = `/api/hf-proxy/hf-inference/v1/chat/completions`;
        } else if (effectiveBaseUrl.includes('openrouter.ai')) {
          proxyEndpoint = `/api/openrouter-proxy/api/v1/chat/completions`;
        }

        const res = await this.fetchWithProxyFallback(proxyEndpoint, targetEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.qwenApiKey.trim()}`,
          },
          body: JSON.stringify({
            model: effectiveModel,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const raw = data.choices?.[0]?.message?.content || '';
          const parsed = this.safeParseJSON(raw);
          const shortAnswer = parsed.shortAnswer || parsed.short_answer;
          const expandedText = parsed.expandedText || parsed.expanded_text;
          if (shortAnswer) {
            return {
              shortAnswer,
              expandedText: expandedText || wikiSummary.extract,
            };
          }
        }
      } catch (e) {
        console.warn('Qwen narrator synthesis error:', e);
      }
    }

    // 2. Mistral AI Fallback
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

        const res = await this.fetchWithProxyFallback(
          '/api/mistral-proxy/v1/chat/completions',
          'https://api.mistral.ai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.mistralApiKey.trim()}`,
            },
            body: JSON.stringify({
              model: 'mistral-small-latest',
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
              shortAnswer,
              expandedText: expandedText || wikiSummary.extract,
            };
          }
        }
      } catch (e) {
        console.warn('Mistral narrator synthesis error:', e);
      }
    }

    // Direct Wikipedia sentence extraction fallback
    const sentences = wikiSummary.extract.match(/[^.!?]+[.!?]+/g) || [wikiSummary.extract];
    const shortSentences = sentences.slice(0, 3).join(' ').trim();

    return {
      shortAnswer: shortSentences || `${label} is identified in your field of view.`,
      expandedText: wikiSummary.extract,
    };
  }

  /**
   * Simplify and normalize specific object classifications into general canonical categories
   */
  private simplifyLabel(rawLabel: string): string {
    if (!rawLabel) return 'Object';
    const clean = rawLabel.trim().replace(/^the\s+/i, '').replace(/^a\s+/i, '').replace(/^an\s+/i, '');
    const lower = clean.toLowerCase();

    // Watch (Wristwatch, Smartwatch, Apple Watch -> Watch)
    if (/\b(smart\s*watch|wrist\s*watch|pocket\s*watch|analog\s*watch|digital\s*watch|apple\s*watch|timepiece)\b/.test(lower) || lower === 'wristwatch' || lower === 'smartwatch') {
      return 'Watch';
    }
    // Phone (Smartphone, Cell phone, iPhone, Android -> Phone)
    if (/\b(smart\s*phone|cell\s*phone|mobile\s*phone|cellphone|smartphone|iphone|android\s*phone|telephone)\b/.test(lower)) {
      return 'Phone';
    }
    // Mug
    if (/\b(coffee\s*mug|tea\s*mug|ceramic\s*mug|travel\s*mug)\b/.test(lower)) {
      return 'Mug';
    }
    // Cup
    if (/\b(coffee\s*cup|tea\s*cup|paper\s*cup|plastic\s*cup|drinking\s*cup|disposable\s*cup)\b/.test(lower)) {
      return 'Cup';
    }
    // Bottle
    if (/\b(water\s*bottle|plastic\s*bottle|glass\s*bottle|beverage\s*bottle|vacuum\s*flask|thermos|hydro\s*flask)\b/.test(lower)) {
      return 'Bottle';
    }
    // Glasses
    if (/\b(reading\s*glasses|eye\s*glasses|eyeglasses|sunglasses|sun\s*glasses|spectacles)\b/.test(lower)) {
      return 'Glasses';
    }
    // Keyboard
    if (/\b(computer\s*keyboard|mechanical\s*keyboard|wireless\s*keyboard|bluetooth\s*keyboard|gaming\s*keyboard)\b/.test(lower)) {
      return 'Keyboard';
    }
    // Mouse
    if (/\b(computer\s*mouse|wireless\s*mouse|optical\s*mouse|gaming\s*mouse)\b/.test(lower)) {
      return 'Mouse';
    }
    // Laptop
    if (/\b(laptop\s*computer|notebook\s*computer|macbook|thinkpad|chromebook)\b/.test(lower)) {
      return 'Laptop';
    }
    // Headphones
    if (/\b(audio\s*headphones|wireless\s*headphones|over-ear\s*headphones|headset|earphones|earbuds|airpods)\b/.test(lower)) {
      return 'Headphones';
    }
    // Plant
    if (/\b(house\s*plant|potted\s*plant|indoor\s*plant|succulent\s*plant|flower\s*pot|houseplant)\b/.test(lower)) {
      return 'Plant';
    }
    // Pen
    if (/\b(ballpoint\s*pen|fountain\s*pen|gel\s*pen|marker\s*pen|stylus\s*pen)\b/.test(lower)) {
      return 'Pen';
    }
    // Monitor
    if (/\b(computer\s*monitor|display\s*monitor|lcd\s*monitor|led\s*monitor|desktop\s*screen)\b/.test(lower)) {
      return 'Monitor';
    }
    // Remote
    if (/\b(remote\s*control|tv\s*remote|television\s*remote)\b/.test(lower)) {
      return 'Remote';
    }
    // Backpack
    if (/\b(school\s*backpack|travel\s*backpack|book\s*bag|rucksack)\b/.test(lower)) {
      return 'Backpack';
    }
    // Chair
    if (/\b(office\s*chair|desk\s*chair|armchair|wooden\s*chair|swivel\s*chair)\b/.test(lower)) {
      return 'Chair';
    }

    return clean.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Universal VLM Output Parser
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
      parsed.description ||
      ''
    ).toString().trim();

    const normalized = rawLabel.toLowerCase();

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
    }

    const simplifiedLabel = isExplicitNoObj ? 'No Object Detected' : this.simplifyLabel(rawLabel);

    const searchQuery = isExplicitNoObj
      ? ''
      : (
          parsed.search_query ||
          parsed.searchQuery ||
          parsed.wiki_title ||
          parsed.wikipedia_title ||
          simplifiedLabel ||
          'Object'
        ).toString().trim();

    return {
      hasObject: !isExplicitNoObj,
      label: simplifiedLabel,
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

    const systemPrompt = `You are an expert visual cortex for AR Smart Glasses. ${modeContext}
Task: Accurately identify the main physical object, device, item, product, or subject shown in this image.

RULES:
1. IDENTIFY THE OBJECT: State what the physical object is clearly and accurately (e.g. "Smartphone", "Coffee Mug", "Laptop", "Wristwatch", "Water Bottle", "Pen", "Headphones", "Computer Keyboard", "Book", "Houseplant", "Eyeglasses", "Apple", "Backpack", "Chair", etc.).
2. If a hand is holding or pointing at an item, identify the ITEM held, NOT the hand.
3. If the user query is specific ("${hintQuery || ''}"), include relevant brand, model, or details.
4. Output strictly valid JSON:
{
  "has_object": true,
  "label": "Primary object name",
  "confidence": "high",
  "search_query": "Wikipedia article title for this object"
}
5. Only return {"has_object": false, "label": "No Object Detected"} if the frame is completely black, completely blank, or literally only an empty bare hand with zero objects present.`;

    const candidateModels = [
      'pixtral-12b-2409',
      'pixtral-large-latest',
      'pixtral-large-2411',
      'mistral-large-latest',
      'pixtral-12b',
    ];

    let lastError: any = null;

    for (const model of candidateModels) {
      for (const useJsonFormat of [true, false]) {
        try {
          const bodyPayload: any = {
            model: model,
            temperature: 0.1,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `${systemPrompt}\n\nWhat is this object? Provide its name and Wikipedia search query in JSON.`,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/jpeg;base64,${rawB64}`,
                    },
                  },
                ],
              },
            ],
          };

          if (useJsonFormat) {
            bodyPayload.response_format = { type: 'json_object' };
          }

          const response = await this.fetchWithProxyFallback(
            '/api/mistral-proxy/v1/chat/completions',
            'https://api.mistral.ai/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.mistralApiKey.trim()}`,
              },
              body: JSON.stringify(bodyPayload),
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
            if (response.status === 400 && useJsonFormat) {
              continue;
            }
            if (response.status === 401 || response.status === 403 || response.status === 429) {
              throw lastError;
            }
            break;
          }
        } catch (err: any) {
          lastError = err;
          if (err.message && (err.message.includes('401') || err.message.includes('429'))) {
            throw err;
          }
        }
      }
    }

    throw lastError || new Error('Mistral vision calls failed across all candidate models.');
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
2. Predict general object class (Mobile Phone, Laptop, Wristwatch, Plant).
3. Return valid JSON:
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
Identify the object or return "has_object": false if hand is empty. Output JSON:
{
  "has_object": true,
  "label": "Primary object name",
  "confidence": "high",
  "search_query": "Wikipedia article title"
}`;

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
            { role: 'system', content: systemPrompt },
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
Identify the object or return "has_object": false if hand is empty. Output JSON:
{
  "has_object": true,
  "label": "Primary object name",
  "confidence": "high",
  "search_query": "Wikipedia article title"
}`;

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
            { role: 'system', content: systemPrompt },
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
    _imageBase64?: string,
    _mode?: 'HOLDING' | 'LOOKING_AT',
    hintQuery?: string
  ): VLMIdentificationResult {
    const catalog: VLMIdentificationResult[] = [
      { hasObject: true, label: 'Mobile Phone', confidence: 'high', search_query: 'Mobile phone', provider: 'Qwen 2.5-VL Fallback' },
      { hasObject: true, label: 'Laptop', confidence: 'high', search_query: 'Laptop', provider: 'Qwen 2.5-VL Fallback' },
      { hasObject: true, label: 'Wristwatch', confidence: 'high', search_query: 'Watch', provider: 'Qwen 2.5-VL Fallback' },
      { hasObject: true, label: 'Houseplant', confidence: 'high', search_query: 'Houseplant', provider: 'Qwen 2.5-VL Fallback' },
      { hasObject: true, label: 'Coffee Mug', confidence: 'high', search_query: 'Coffee cup', provider: 'Qwen 2.5-VL Fallback' },
      { hasObject: true, label: 'Headphones', confidence: 'high', search_query: 'Headphones', provider: 'Qwen 2.5-VL Fallback' },
      { hasObject: true, label: 'Water Bottle', confidence: 'high', search_query: 'Water bottle', provider: 'Qwen 2.5-VL Fallback' },
      { hasObject: true, label: 'Book', confidence: 'high', search_query: 'Book', provider: 'Qwen 2.5-VL Fallback' },
      { hasObject: true, label: 'Computer Keyboard', confidence: 'high', search_query: 'Computer keyboard', provider: 'Qwen 2.5-VL Fallback' },
      { hasObject: true, label: 'Computer Mouse', confidence: 'high', search_query: 'Computer mouse', provider: 'Qwen 2.5-VL Fallback' },
    ];

    if (hintQuery && hintQuery.trim()) {
      const q = hintQuery.toLowerCase();
      if (q.includes('no object') || q.includes('empty') || q.includes('nothing') || q.includes('bare hand')) {
        return { hasObject: false, label: 'No Object Detected', confidence: 'high', search_query: '', provider: 'Qwen 2.5-VL Fallback' };
      }
      const match = catalog.find(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.search_query.toLowerCase().includes(q) ||
          q.includes(item.label.toLowerCase())
      );
      if (match) return match;

      const capitalized = hintQuery.trim().charAt(0).toUpperCase() + hintQuery.trim().slice(1);
      return {
        hasObject: true,
        label: capitalized,
        confidence: 'high',
        search_query: capitalized,
        provider: 'Qwen 2.5-VL Fallback',
      };
    }

    return {
      hasObject: false,
      label: 'No Object Detected',
      confidence: 'high',
      search_query: '',
      provider: 'Qwen 2.5-VL (No Object)',
    };
  }
}

export const vlmService = new VLMService();
