import { Hono, type Context } from 'hono';
import type { Env } from './env.js';
import brandRouter from './routes/brand.js';
import { pillarRouter } from './routes/pillar.js';
import campaignRouter from './routes/campaign.js';
import { aiConfigRouter } from './routes/ai-config.js';
import { promptVersionRouter } from './routes/prompt-version.js';
import { ideaRouter } from './routes/idea.js';
import { draftRouter } from './routes/draft.js';
import { safetyRouter } from './routes/safety.js';
import { approvalRouter } from './routes/approval.js';

const app = new Hono<{ Bindings: Env }>().basePath('/api/content');

app.route('/brands', brandRouter);
app.route('/pillars', pillarRouter);
app.route('/campaigns', campaignRouter);
app.route('/ai-configs', aiConfigRouter);
app.route('/prompt-versions', promptVersionRouter);
app.route('/ideas', ideaRouter);
app.route('/drafts', draftRouter);
app.route('/drafts', safetyRouter);
app.route('/approvals', approvalRouter);
app.route('/drafts', approvalRouter);

const ce1NotFound = (c: Context<{ Bindings: Env }>) =>
  c.json(
    { ok: false, error: { code: 'NOT_FOUND', message: 'This feature is not part of CE-1.' } },
    404
  );

app.all('/assets/*', ce1NotFound);
app.all('/templates/*', ce1NotFound);
app.all('/render/*', ce1NotFound);
app.all('/publish/*', ce1NotFound);
app.all('/schedule/*', ce1NotFound);
app.all('/platform-connections/*', ce1NotFound);
app.all('/webhooks/*', ce1NotFound);
app.all('/analytics/import', ce1NotFound);
app.all('/vectorize/*', ce1NotFound);
app.all('/video/*', ce1NotFound);

app.get('/ready', (c) => c.json({ ok: true, data: { status: 'ok' } }));

export default app;
