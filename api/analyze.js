export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { imageBase64, mimeType } = req.body;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing on server" });
    }

    const prompt = `
    Ты — архитектурный Vision AI. Проанализируй загруженную план-схему квартиры.
    Определи геометрию всех комнат, их названия, площади в м² и размеры в мм.
    Рассчитай координаты x, y, width, height для SVG-холста 750x580.
    
    Верни результат ИСКЛЮЧИТЕЛЬНО в виде валидного JSON-объекта без каких-либо пояснений или разметки:
    {
      "total_area": 42.0,
      "rooms": [
        {"name": "Спальня", "area_sqm": 14.1, "width_mm": 4700, "x": 150, "y": 60, "width": 282, "height": 180},
        {"name": "Кухня-гостиная", "area_sqm": 15.9, "width_mm": 5650, "x": 150, "y": 300, "width": 339, "height": 180},
        {"name": "Санузел", "area_sqm": 3.6, "width_mm": 2000, "x": 432, "y": 60, "width": 118, "height": 150}
      ]
    }
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } }
            ]
          }],
          generationConfig: {
            response_mime_type: "application/json"
          }
        })
      }
    );

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
      return res.status(500).json({ error: "Gemini response error", details: data });
    }

    const rawText = data.candidates[0].content.parts[0].text;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return res.status(500).json({ error: "No JSON found in response" });
    }

    const cleanJson = JSON.parse(jsonMatch[0]);
    return res.status(200).json(cleanJson);
  } catch (error) {
    return res.status(500).json({ error: "Analysis failed", details: error.message });
  }
}
