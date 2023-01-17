import { Bot, Context, GrammyError, HttpError, InputFile } from "grammy";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = "http://127.0.0.1:5000";

const BOT_FILES_URL = "https://api.telegram.org/file/bot";

const ALLOWED_EXTENSIONS = ['txt', 'csv'];

const bot = new Bot<Context>(process.env.BOT_KEY!); 

bot.on("message:file", async (ctx) => {
  try {
    const doc = ctx.msg.document;
    const extension = doc?.file_name?.split('.').at(-1);

    if (!ALLOWED_EXTENSIONS.includes(extension!)) {
      await ctx.reply(`Format is not supported! Supported formats: [${ALLOWED_EXTENSIONS.toString()}].`);
      return;
    }

    if (doc?.file_size! > 4e6) {
      await ctx.reply('The file is too big! Max file size is 4MB!');
      return;
    }

    const file = await ctx.getFile();
    console.log(file);
    const path = BOT_FILES_URL + process.env.BOT_KEY + '/' + file.file_path;
    console.log(path);

    const payload = {
      link: path,
      file_id: file.file_unique_id
    }

    const message = await ctx.reply("processing...");

    const request = await fetch(BASE_URL + "/api/create_deck", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const response = await request.json();

    if (response.status === 'success') {
      await bot.api.editMessageText(ctx.chat.id, message.message_id, '✅ done');
      await ctx.replyWithDocument(new InputFile(
        new URL(response.link)
      ));
    }

  } catch (e) {
    console.log(e);
  }
});

bot.start({onStart: () => {
  console.log("Bot is up and running!")
}});

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});