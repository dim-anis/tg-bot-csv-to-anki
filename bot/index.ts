import { Bot, Context, GrammyError, HttpError, InputFile } from "grammy";
import dotenv from "dotenv";
import { parse } from 'csv-parse/sync';

dotenv.config();

const BASE_URL = "http://127.0.0.1:5000";

const BOT_FILES_URL = "https://api.telegram.org/file/bot";

const ALLOWED_EXTENSIONS = ['txt', 'csv'];

const bot = new Bot<Context>(process.env.BOT_KEY!);

bot.command('start', async (ctx) => {
  const message = `This Bot will transform your <b>CSV file</b> or <b>plain text message</b> with vocabulary to an <b>Anki Deck</b>.
\nThere are some rules:
\n1. Maximum file size is 4MB
2. Files other than <b>txt</b> and <b>csv</b> will be ignored
3. <b>Number of fields</b> is defined by looking at the first row
4. Delimiter is set by looking at the first row (only commas, only tabs or only semicolons)
5. Invalid words and phrases will be ignored`

  await ctx.reply(message, {parse_mode: "HTML"});
})

bot.on("message:file", async (ctx) => {
  try {
    const doc = ctx.msg.document;
    const extension = doc?.file_name?.split('.').at(-1);
    const file_size = doc?.file_size!;

    if (!ALLOWED_EXTENSIONS.includes(extension!)) {
      const message = `<b>Format is not supported!</b>\n\nYour file: <b>${extension}</b>\nSupported formats: <b>${ALLOWED_EXTENSIONS.join(', ')}</b>`;
      await ctx.reply(message, {parse_mode: "HTML"});
      return;
    }

    if (file_size > 4e6) {
      const user_file_size = file_size > 1e6 ? ">" + Math.floor(file_size / 1e6) + "MB" : ">" + Math.floor(file_size / 1000) + "KB";
      const message = `<b>The file is too big!</b>\n\nYour file: <b>${user_file_size}</b>\nMax file size: <b>4MB</b>`
      await ctx.reply(message, {parse_mode: 'HTML'});
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

bot.on("message:text", async (ctx) => {
  let data: string[][] = [];
  const userInput = ctx.msg.text;
  const records = parse(userInput, {
    delimiter: [";", ",", "|"],
    skip_empty_lines: true,
    skip_records_with_empty_values: true,
    trim: true
  });
  console.log(records)

  if (records.length === 1 && records[0].length === 1) {
    const message = `<b>List is too short!</b>\n\nYour vocabulary list is too short or no delimiter was detected`
    await ctx.reply(message, {parse_mode: "HTML"});
    return;
  }

  // case where there is on row
  if (records.length === 1 && records[0].length > 1) {
    data = [...records[0].map((rec: string) => [rec])];
  }

  // case where there are multiple columns
  if (records.length > 1) {
    data = records;
  }

  const payload = {
    data: data,
  }

  const message = await ctx.reply(`Processing ${data.length} entries...`);

  const request = await fetch(BASE_URL + "/api/create_deck", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const response = await request.json();

  if (response.status === 'success') {
    const success_message = `✅ <b>Done!</b>\n\nTotal items processed: <b>${response.lines_processed}</b>\nTotal cards added to deck: <b>${response.cards_created}</b>`;
    await bot.api.editMessageText(ctx.chat.id, message.message_id, success_message, {parse_mode: "HTML"});
    await ctx.replyWithDocument(new InputFile(
      new URL(response.link)
    ));
  }
  
})

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