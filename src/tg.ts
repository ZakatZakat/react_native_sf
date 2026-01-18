// anywhere client-side
const tg = window.Telegram?.WebApp
tg?.MainButton?.setParams({ text: "Submit" })
tg?.MainButton?.show()
// To send data back to the bot:
tg?.sendData(JSON.stringify({ ok: true }))
