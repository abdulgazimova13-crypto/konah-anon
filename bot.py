import os
import random
import asyncio

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

# Пользователи, которые сейчас ищут собеседника
waiting_users = []

# Пары: user_id -> user_id
pairs = {}


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 Добро пожаловать в анонимный чат!\n\n"
        "Нажми /search, чтобы найти случайного собеседника.\n"
        "Нажми /stop, чтобы закончить диалог."
    )


async def search(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id

    if user_id in pairs:
        await update.message.reply_text("💬 Ты уже общаешься с собеседником!")
        return

    if user_id in waiting_users:
        await update.message.reply_text("🔎 Ты уже ищешь собеседника...")
        return

    if waiting_users:
        partner_id = random.choice(waiting_users)
        waiting_users.remove(partner_id)

        pairs[user_id] = partner_id
        pairs[partner_id] = user_id

        await context.bot.send_message(
            user_id,
            "🎉 Собеседник найден!\n"
            "Можешь писать сообщения. Всё анонимно."
        )

        await context.bot.send_message(
            partner_id,
            "🎉 Собеседник найден!\n"
            "Можешь писать сообщения. Всё анонимно."
        )

    else:
        waiting_users.append(user_id)
        await update.message.reply_text(
            "🔎 Ищу тебе собеседника..."
        )


async def stop(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id

    if user_id in waiting_users:
        waiting_users.remove(user_id)
        await update.message.reply_text("❌ Поиск отменён.")
        return

    if user_id in pairs:
        partner_id = pairs[user_id]

        del pairs[user_id]

        if partner_id in pairs:
            del pairs[partner_id]

        await update.message.reply_text("❌ Диалог завершён.")

        try:
            await context.bot.send_message(
                partner_id,
                "❌ Собеседник завершил диалог."
            )
        except:
            pass

    else:
        await update.message.reply_text(
            "У тебя сейчас нет активного диалога."
        )


async def message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id

    if user_id not in pairs:
        await update.message.reply_text(
            "Сначала найди собеседника через /search 🔎"
        )
        return

    partner_id = pairs[user_id]

    try:
        await context.bot.send_message(
            partner_id,
            update.message.text
        )
    except:
        await update.message.reply_text(
            "⚠️ Не удалось отправить сообщение."
        )


async def main():
    token = os.getenv("BOT_TOKEN")

    if not token:
        print("Ошибка: BOT_TOKEN не найден.")
        return

    app = Application.builder().token(token).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("search", search))
    app.add_handler(CommandHandler("stop", stop))

    app.add_handler(
        MessageHandler(
            filters.TEXT & ~filters.COMMAND,
            message_handler
        )
    )

    print("Бот запущен!")

    await app.initialize()
    await app.start()
    await app.updater.start_polling()

    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(main())
