export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Метод не разрешен" });

  try {
    const { imageBase64, mimeType } = req.body || {};
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_KEY) {
      return res.status(400).json({ error: "GEMINI_API_KEY не найден в Vercel" });
    }
    if (!imageBase64) {
      return res.status(400).json({ error: "Изображение не передано" });
    }

    const prompt = `
    Ты — архитектурный Vision AI. Проанализируй предоставленную план-схему квартиры.
    Определи геометрию всех комнат, их названия, площади в м² и размеры в мм.
    Рассчитай SVG-координаты x, y, width, height для холста 750x580.
    
    Верни результат ИСКЛЮЧИТЕЛЬНО в виде JSON-объекта без любого описательного текста:
    {
      "total_area": 42.0,
      "rooms": [
        {"name": "Спальня", "area_sqm": 14.1, "width_mm": 4700, "x": 150, "y": 60, "width": 282, "height": 180},
        {"name": "Кухня-гостиная", "area_sqm": 15.9, "width_mm": 5650, "x": 150, "y": 300, "width": 339, "height": 180},
        {"name": "Санузел", "area_sqm": 3.6, "width_mm": 2000, "x": 432, "y": 60, "width": 118, "height": 150}
      ]
    }
    `;

    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } }
            ]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await apiRes.json();

    if (!apiRes.ok || data.error) {
      const errMsg = data.error?.message || JSON.stringify(data.error || data);
      return res.status(apiRes.status || 500).json({ error: "Google API: " + errMsg });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(500).json({ error: "Gemini вернул пустой результат" });
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: "Ответ не содержит JSON" });
    }

    const cleanJson = JSON.parse(match[0]);
    return res.status(200).json(cleanJson);

  } catch (error) {
    return res.status(500).json({ error: "Ошибка сервера: " + error.message });
  }
}
