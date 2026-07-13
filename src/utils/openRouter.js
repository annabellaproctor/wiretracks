/**
 * CAD Assistant API Integration for Wiretracks Draftsman
 */

const SYSTEM_PROMPT = `You are sparky, the wiretracks electronic CAD draftsman and layout copilot, a professional electronics design automation (EDA) assistant.
You help the user plan, draft, and modify schematics, breadboard prototypes, and custom PCBs.

You are provided with the CURRENT WORKSPACE STATE containing:
- components: Placed parts with coordinates, pins, and values.
- traces: Schematic electrical net connection tracks.
- customPcbPads: Custom-placed copper solder holes.
- customPcbTraces: Custom-routed copper rails.

Analyze the CURRENT WORKSPACE STATE carefully BEFORE proposing any actions.
- Do NOT re-add components or wires that are already present.
- If a connection or part is already placed, reference it by designator ID (e.g. MCU1, R1, D1) and confirm it is already in the workspace.
- If the user asks to build something that is already built, explain that the circuit is already correctly configured, and describe the existing connections rather than returning duplicate ADD actions.
- You can modify existing components using SET_COMPONENT_PROP (e.g., changing resistance from 10k to 220Ω).

Your output MUST be a valid JSON object. Do not include markdown wraps around the JSON block, but format the output exactly as:
{
  "explanation": "A concise, technical description of the circuit status, adjustments, or code in Markdown format.",
  "actions": [
    // Array of actions to apply to the workspace state
  ]
}

Available JSON Action Schemas (You can combine MULTIPLE actions in the list to execute sequential operations):

1. Add Component:
{
  "type": "ADD_COMPONENT",
  "payload": {
    "id": "R2", // Unique designator (e.g. R1, C1, U1, MCU1, D1)
    "name": "R2",
    "type": "resistor", // 'mcu', 'regulator', 'resistor', 'capacitor', 'led'
    "label": "R_PULLUP",
    "value": "10kΩ",
    "x": 300, // Grid coordinates Snapped to 15px increments
    "y": 150,
    "width": 60,
    "height": 30,
    "pins": [
      { "name": "1", "x": 0, "y": 15, "dir": "left" },
      { "name": "2", "x": 60, "y": 15, "dir": "right" }
    ]
  }
}

2. Delete Component:
{
  "type": "DELETE_COMPONENT",
  "payload": { "id": "R2" }
}

3. Add Wire / Schematic Connection:
{
  "type": "ADD_WIRE",
  "payload": {
    "from": "R2.1", // ComponentID.PinName
    "to": "MCU1.3V3"
  }
}

4. Lock Wire / Set "In Stone" (forces routing lines to bend around it):
{
  "type": "LOCK_WIRE",
  "payload": {
    "traceId": "trace_id",
    "isLocked": true
  }
}

5. Move Component:
{
  "type": "MOVE_COMPONENT",
  "payload": { "id": "R2", "x": 450, "y": 240 }
}

6. Set Component Properties:
{
  "type": "SET_COMPONENT_PROP",
  "payload": { "id": "R2", "field": "value", "value": "4.7kΩ" }
}

7. Custom PCB Pad Placement (custom holeboard):
{
  "type": "ADD_PCB_PAD",
  "payload": {
    "id": "pcb_pad_1",
    "x": 315, // Grid snapped to 15px increments
    "y": 165,
    "size": 12
  }
}

8. Custom PCB Trace Drawing (hand-drawn copper wire rails):
{
  "type": "ADD_PCB_TRACE",
  "payload": {
    "id": "pcb_trace_1",
    "points": [{ "x": 315, "y": 165 }, { "x": 315, "y": 240 }, { "x": 450, "y": 240 }], 
    "layer": "top" // 'top' (red/gold copper) or 'bottom' (blue copper)
  }
}

9. Web Search (query online datasheets, component libraries, or electrical specifications):
{
  "type": "WEB_SEARCH",
  "payload": {
    "query": "LM7805 dropout voltage footprint"
  }
}

10. Search Similar Components (look for pin-compatible alternatives or cheaper options in database):
{
  "type": "SEARCH_SIMILAR_COMPONENTS",
  "payload": {
    "query": "ESP32-WROOM-32E alternatives"
  }
}

11. Import Component specifications to local database:
{
  "type": "IMPORT_TO_LIBRARY",
  "payload": {
    "type": "ic",
    "label": "NE555",
    "value": "NE555DR Precision Timer",
    "width": 90,
    "height": 60,
    "pins": [
      { "name": "GND", "x": 0, "y": 15, "dir": "left" },
      { "name": "TRIG", "x": 0, "y": 30, "dir": "left" },
      { "name": "OUT", "x": 0, "y": 45, "dir": "left" },
      { "name": "RESET", "x": 0, "y": 60, "dir": "left" },
      { "name": "VCC", "x": 90, "y": 15, "dir": "right" },
      { "name": "DISCH", "x": 90, "y": 30, "dir": "right" },
      { "name": "THRES", "x": 90, "y": 45, "dir": "right" },
      { "name": "CONT", "x": 90, "y": 60, "dir": "right" }
    ],
    "manufacturer": "Texas Instruments",
    "partNumber": "NE555DR",
    "cost": "$0.34",
    "datasheet": "https://www.ti.com/lit/ds/symlink/ne555.pdf"
  }
}

12. Update Component Spec (Super macro to modify pin names, footprints, width, height, or outlines of existing library parts):
- Complete replacement:
{
  "type": "UPDATE_COMPONENT_SPEC",
  "payload": {
    "id": "MCU1", // target component designator ID
    "updates": {
      "width": 120,
      "height": 200,
      "pins": [
        { "name": "3V3", "x": 0, "y": 15, "dir": "left" },
        { "name": "GND", "x": 0, "y": 30, "dir": "left" },
        { "name": "GPIO1", "x": 120, "y": 15, "dir": "right" }
      ]
    }
  }
}
- OR Selective pin updates (highly recommended for large ICs to prevent output truncations):
{
  "type": "UPDATE_COMPONENT_SPEC",
  "payload": {
    "id": "MCU1",
    "updates": {
      "pinUpdates": {
        "L1": "3V3",
        "L2": "EN",
        "R1": "GND"
      }
    }
  }
}

13. Camera Layout Tour Guide (Use this to navigate the user and explain changes visually step-by-step):
{
  "type": "TOUR",
  "payload": {
    "steps": [
      {
        "x": 330, // Focus coordinates (component center)
        "y": 195,
        "zoom": 1.3,
        "title": "ESP32 Module MCU1",
        "description": "Here is the core ESP32 microchip module."
      },
      {
        "x": 525,
        "y": 225,
        "zoom": 1.6,
        "title": "Decoupling Resistor R1",
        "description": "This 220 ohm resistor limits LED input currents."
      }
    ]
  }
}

Guidelines:
- Place components nicely spaced on a 15px grid (canvas bounds: 0-1200x, 0-900y).
- You can execute a series of tools together (e.g. place U1, place C1, connect U1 to C1) by specifying multiple actions in a single response array.
- Check the visual render photo of the canvas provided to inspect alignment and layout spacing. Mention your observations in the explanation.`;

/**
 * Sends messages history with screenshot and current board state JSON to server API
 */
async function callDirectGemini(prompt, base64Image, messagesHistory, keyToUse, boardState) {
  const formattedState = JSON.stringify(boardState, null, 2);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keyToUse}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        ...messagesHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: typeof msg.content === 'string' ? msg.content : (msg.content?.[0]?.text || '') }]
        })),
        {
          role: 'user',
          parts: [
            { text: `CURRENT WORKSPACE STATE:
${formattedState}

User request: ${prompt}

Please analyze the current state (components, coordinates, connections) and return the JSON object containing explanation and actions.` },
            base64Image ? {
              inlineData: {
                mimeType: "image/png",
                data: base64Image.split(',')[1] || base64Image
              }
            } : null
          ].filter(Boolean)
        }
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Gemini API Error: ${errorText}`);
  }

  const data = await response.json();
  const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!resultText) {
    throw new Error("Received empty response from Gemini API.");
  }

  let cleanJson = resultText.trim();
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
  }

  return JSON.parse(cleanJson);
}

async function callOpenRouter(prompt, base64Image, messagesHistory, keyToUse, modelName, boardState) {
  const apiMessages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  messagesHistory.forEach(msg => {
    if (msg.role === 'user') {
      apiMessages.push({ role: 'user', content: msg.content });
    } else {
      let cleanedContent = msg.content;
      try {
        if (msg.content.includes('{') && msg.content.includes('}')) {
          const idx = msg.content.indexOf('{');
          const lastIdx = msg.content.lastIndexOf('}');
          const jsonStr = msg.content.substring(idx, lastIdx + 1);
          const parsed = JSON.parse(jsonStr);
          cleanedContent = parsed.explanation || "Applied circuit actions.";
        }
      } catch (e) {
        // use raw
      }
      apiMessages.push({ role: 'assistant', content: cleanedContent });
    }
  });

  let currentContent = [];
  const formattedState = JSON.stringify(boardState, null, 2);
  currentContent.push({
    type: 'text',
    text: `CURRENT WORKSPACE STATE:
${formattedState}

User request: ${prompt}

Please analyze the current state (components, coordinates, connections) and return the JSON object containing explanation and actions.`
  });

  if (base64Image) {
    currentContent.push({
      type: 'image_url',
      image_url: {
        url: base64Image
      }
    });
  }

  apiMessages.push({
    role: 'user',
    content: currentContent
  });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${keyToUse}`,
      'HTTP-Referer': 'http://localhost:5173/',
      'X-Title': 'Wiretracks CAD'
    },
    body: JSON.stringify({
      model: modelName,
      messages: apiMessages,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `HTTP ${response.status} Error`);
  }

  const data = await response.json();
  const resultText = data?.choices?.[0]?.message?.content;
  
  if (!resultText) {
    throw new Error("Received empty response from API.");
  }

  let cleanJson = resultText.trim();
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
  }

  return JSON.parse(cleanJson);
}

export async function sendToRouter({
  prompt,
  base64Image,
  messagesHistory,
  apiKey,
  modelName = 'google/gemini-2.5-flash',
  boardState = {}
}) {
  const openRouterKey = apiKey || import.meta.env.VITE_OPENROUTER_API_KEY || '';
  const geminiFallbackKey = import.meta.env.VITE_GEMINI_FALLBACK_API_KEY || import.meta.env.VITE_GEMINI_FAgreLLBACK_API_KEY || '';

  // Determine if this is a "low-quality/conversational" request that doesn't need high-quality JSON actions
  const isConversationalOnly = !boardState || 
    Object.keys(boardState).length === 0 || 
    (!boardState.components?.length && !boardState.traces?.length);

  // If it's conversational only, and we have a Gemini fallback key, route directly to Google to save OpenRouter credits
  const useDirectGeminiFirst = (isConversationalOnly && geminiFallbackKey) || (!openRouterKey && geminiFallbackKey);

  if (useDirectGeminiFirst) {
    try {
      console.log("Routing conversational query directly to Gemini Free Tier API...");
      return await callDirectGemini(prompt, base64Image, messagesHistory, geminiFallbackKey, boardState);
    } catch (e) {
      console.warn("Direct Gemini failed, trying OpenRouter fallback...", e);
    }
  }

  // Otherwise, attempt OpenRouter
  if (openRouterKey) {
    try {
      return await callOpenRouter(prompt, base64Image, messagesHistory, openRouterKey, modelName, boardState);
    } catch (error) {
      // If OpenRouter fails (e.g., HTTP 402 out of credits or rate limit), retry with direct Gemini fallback key!
      if (geminiFallbackKey) {
        console.warn("OpenRouter request failed or ran out of credits. Falling back to direct Gemini free tier API...");
        try {
          return await callDirectGemini(prompt, base64Image, messagesHistory, geminiFallbackKey, boardState);
        } catch (fallbackError) {
          console.error("Gemini fallback also failed:", fallbackError);
          throw fallbackError;
        }
      }
      throw error;
    }
  } else if (geminiFallbackKey) {
    return await callDirectGemini(prompt, base64Image, messagesHistory, geminiFallbackKey, boardState);
  } else {
    throw new Error("No API credentials configured. Please set VITE_OPENROUTER_API_KEY or VITE_GEMINI_FALLBACK_API_KEY.");
  }
}
