const { Telegraf } = require('telegraf');
const fs = require('fs');

// Загружаем викторины из JSON
const quizzes = JSON.parse(fs.readFileSync('quizzes.json', 'utf-8'));

// Создаем бот
const bot = new Telegraf('YOUR_BOT_TOKEN_HERE');

// Команда /start
bot.start((ctx) => {
  ctx.reply('Привет! Я QuizMasterBot. Выбери тему викторины:', {
    reply_markup: {
      inline_keyboard: Object.keys(quizzes).map((theme) => [
        { text: theme, callback_data: `theme:${theme}` }
      ])
    }
  });
});

// Обработка выбора темы
bot.on('callback_query', (ctx) => {
  const [type, theme] = ctx.callbackQuery.data.split(':');
  if (type === 'theme' && quizzes[theme]) {
    ctx.session = { theme, questionIndex: 0, score: 0 }; // Инициализируем сессию
    return sendQuestion(ctx);
  }
  ctx.answerCbQuery('Неверный выбор!');
});

// Отправка вопроса
function sendQuestion(ctx) {
  const session = ctx.session;
  const quiz = quizzes[session.theme];
  if (session.questionIndex < quiz.length) {
    const question = quiz[session.questionIndex];
    return ctx.reply(question.question, {
      reply_markup: {
        inline_keyboard: question.options.map((opt, idx) => [
          { text: opt, callback_data: `answer:${idx}` }
        ])
      }
    });
  }
  // Завершение викторины
  ctx.reply(`Викторина завершена! Ты набрал ${session.score} очков.`);
}

// Обработка ответа
bot.on('callback_query', (ctx) => {
  const [type, answer] = ctx.callbackQuery.data.split(':');
  if (type === 'answer') {
    const session = ctx.session;
    const quiz = quizzes[session.theme];
    const question = quiz[session.questionIndex];
    if (parseInt(answer) === question.answer) {
      session.score++;
      ctx.answerCbQuery('Верно!');
    } else {
      ctx.answerCbQuery('Неверно!');
    }
    session.questionIndex++;
    return sendQuestion(ctx);
  }
});

// Запуск бота
bot.launch().then(() => console.log('Бот запущен! 🚀'));

// Обработка завершения
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));