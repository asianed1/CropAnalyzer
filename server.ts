import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please add it in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function collectAndroidFiles(dir: string, baseDir: string): { path: string; content: string }[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: { path: string; content: string }[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectAndroidFiles(full, baseDir));
    } else {
      const rel = path.relative(baseDir, full).replace(/\\/g, '/');
      results.push({ path: rel, content: fs.readFileSync(full, 'utf8') });
    }
  }
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'cropanalyzer-cloud-fallback' });
  });

  /**
   * ~5% Cloud Fallback Endpoint using Gemini multimodal analysis.
   * Accepts the compressed bounding-box ROI crop + farmer pulldown context.
   */
  app.post('/api/cloud-diagnose', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', transportUsed = 'wifi', context = {} } = req.body ?? {};
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'Cropped bounding-box image data is required.' });
      }

      const ai = getGeminiClient();
      const prompt = [
        'You are an expert tropical plant pathologist, entomologist, and agronomist specializing in Southeast Asian agriculture, assisting a farmer whose offline 30-crop & abiotic mobile model could not confidently diagnose this sample.',
        'Analyze the cropped bounding-box image carefully together with the farmer-supplied field metadata below. Consider pests, diseases, AND abiotic/environmental causes (drought, overwatering, low sunlight, fertilizer burn, nutrient deficiency, heat/sunscald, herbicide drift, soil salinity/acidity, wind damage).',
        `Farmer Context: suspectedCrop=${context.suspectedCropId || 'auto'}, plantPart=${context.plantPart || 'unknown'}, primarySymptom=${context.primarySymptom || 'unknown'}, growthStage=${context.growthStage || 'unknown'}, fieldCondition=${context.fieldCondition || 'unknown'}, soilMoisture=${context.soilMoisture || 'unknown'}, sunlightExposure=${context.sunlightExposure || 'unknown'}, recentInputs=${context.recentInputs || 'unknown'}${context.notes ? `, notes=${context.notes}` : ''}.`,
        'Return a precise agronomic diagnosis identifying both the plant/crop (common and scientific name) and the pest, disease, or abiotic condition (with scientific name or abiotic classification), calibrated probability percentage (0-100), concise reasoning, and practical field recommendations (immediateActions, biologicalControl, chemicalGuidance, prevention).',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          systemInstruction:
            'Provide accurate, practical agricultural diagnostics. Never fabricate certainty if an image is unclear; calibrate probabilityPercent honestly and recommend consulting local agricultural extension for exact chemical dosages.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cropCommonName: { type: Type.STRING, description: 'Common name of the identified plant or crop.' },
              cropScientificName: { type: Type.STRING, description: 'Scientific binomial name of the plant or crop.' },
              diagnosisName: { type: Type.STRING, description: 'Identified pest, disease, or abiotic condition name.' },
              pathogenScientificName: { type: Type.STRING, description: 'Scientific name of causal pathogen or pest, or N/A if abiotic.' },
              category: { type: Type.STRING, description: 'One of Fungal, Bacterial, Viral, Pest, Abiotic, or Healthy.' },
              probabilityPercent: { type: Type.INTEGER, description: 'Calibrated diagnostic probability from 0 to 100.' },
              reasoning: { type: Type.STRING, description: 'Brief 2-sentence visual and contextual justification.' },
              recommendations: {
                type: Type.OBJECT,
                properties: {
                  immediateActions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  biologicalControl: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  chemicalGuidance: { type: Type.STRING },
                  prevention: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        return res.status(502).json({ error: 'Gemini returned an empty response.' });
      }
      const parsed = JSON.parse(rawText);
      res.json({
        ...parsed,
        transportUsed,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected Gemini cloud fallback error.';
      const status = message.includes('GEMINI_API_KEY') ? 500 : 502;
      res.status(status).json({ error: message });
    }
  });

  /**
   * Lists native Android Studio Kotlin/Compose project files for in-app inspection.
   */
  app.get('/api/android-files', (_req, res) => {
    const androidDir = path.join(__dirname, 'android');
    const files = collectAndroidFiles(androidDir, androidDir);
    res.json({ files });
  });

  /**
   * Downloads the complete native Android Studio Kotlin/Compose project as a ZIP archive.
   */
  app.get('/api/android-project.zip', async (_req, res) => {
    try {
      const androidDir = path.join(__dirname, 'android');
      const files = collectAndroidFiles(androidDir, androidDir);
      const zip = new JSZip();
      for (const file of files) {
        zip.file(`CropAnalyzer/${file.path}`, file.content);
      }
      const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="CropAnalyzer-Android.zip"');
      res.send(buffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to package Android ZIP';
      res.status(500).json({ error: msg });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      appType: 'spa',
    });
    app.get('/@vite/client', (_req, res, next) => {
      const origEnd = res.end.bind(res);
      const chunks: Buffer[] = [];
      res.write = ((chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      }) as typeof res.write;
      res.end = ((chunk?: Buffer | string) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const raw = Buffer.concat(chunks).toString('utf8');
        const patched = raw.replace(
          'transport.connect(createHMRHandler(handleMessage));',
          '/* WebSocket HMR disabled */'
        );
        res.setHeader('Content-Length', Buffer.byteLength(patched));
        return origEnd(patched);
      }) as typeof res.end;
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CropAnalyzer server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
