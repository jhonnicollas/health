const TELEGRAM_API = 'https://api.telegram.org/bot'

type InlineKeyboardButton = { text: string; callback_data?: string; url?: string }
type InlineKeyboardMarkup = { inline_keyboard: InlineKeyboardButton[][] }

export type SendMessageResult = { ok: boolean; messageId?: number; error?: string }
export type EditMessageResult = { ok: boolean; error?: string }

export const TelegramClientService = {
  buildInlineKeyboard(buttons: InlineKeyboardButton[][]): InlineKeyboardMarkup {
    return { inline_keyboard: buttons }
  },

  async sendMessage(token: string, chatId: string, text: string, keyboard?: InlineKeyboardMarkup): Promise<SendMessageResult> {
    try {
      const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' }
      if (keyboard) body.reply_markup = keyboard
      const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const t = await res.text(); return { ok: false, error: t.slice(0, 200) } }
      const json = await res.json() as any
      return { ok: true, messageId: json?.result?.message_id }
    } catch (e) { return { ok: false, error: String(e) } }
  },

  async editMessageText(token: string, chatId: string, messageId: number, text: string, keyboard?: InlineKeyboardMarkup): Promise<EditMessageResult> {
    try {
      const body: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' }
      if (keyboard) body.reply_markup = keyboard
      const res = await fetch(`${TELEGRAM_API}${token}/editMessageText`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const t = await res.text(); return { ok: false, error: t.slice(0, 200) } }
      return { ok: true }
    } catch (e) { return { ok: false, error: String(e) } }
  },

  async answerCallbackQuery(token: string, callbackQueryId: string, text?: string): Promise<boolean> {
    try {
      const body: Record<string, unknown> = { callback_query_id: callbackQueryId }
      if (text) body.text = text
      const res = await fetch(`${TELEGRAM_API}${token}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      return res.ok
    } catch { return false }
  }
}
