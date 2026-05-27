import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tseRouter from './routes/tse';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// CORS — libera localhost (dev) + a URL de produção do frontend, se vier
// na env. Mantém uma whitelist simples: nada de wildcard em produção.
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL,
].filter((o): o is string => !!o);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requests sem Origin (curl, health checks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS bloqueado para origin: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: '1mb' }));

// Log básico de requests — ajuda muito em produção quando algo dá errado.
app.use((req, _res, next) => {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Health check do servidor (não toca TSE — pra Railway/uptime monitor).
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Vórtice Backend — TSE Integration',
    version: '1.0.0',
  });
});

// Rotas TSE
app.use('/api/tse', tseRouter);

// 404 padrão
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
});

// Handler global de erro (último middleware). Evita stacktrace cru
// vazando pro cliente.
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({
    error: err.message || 'Erro interno',
  });
});

app.listen(PORT, () => {
  console.log('────────────────────────────────────────────────────');
  console.log(`✅ Vórtice Backend rodando em http://localhost:${PORT}`);
  console.log('📡 TSE API proxy ativo em /api/tse');
  console.log(`🛡️  CORS aceito de: ${allowedOrigins.join(', ')}`);
  console.log('────────────────────────────────────────────────────');
});
