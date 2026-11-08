import {ok} from '../lib/shared.js';
export const onRequestGet = ctx=>ok({service:'VehicleAI Browser Edition',database:!!ctx.env.DB,gmail:!!(ctx.env.GMAIL_CLIENT_ID&&ctx.env.GMAIL_REFRESH_TOKEN&&ctx.env.GMAIL_CLIENT_SECRET)});
