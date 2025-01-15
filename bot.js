const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const bot = new Telegraf('YOUR_BOT_TOKEN'); // Замените на ваш токен

// Загружаем вопросы из файла
const questionsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json')));

// Функция для начала викторины
async function startQuiz(ctx) {
  ctx.reply('Выберите тему викторины:\n1. Литература\n2. Наука');

  // Ожидаем выбора темы
  bot.once('text', (ctx) => {
    const message = ctx.message.text.toLowerCase();

    if (message === '1' || message === 'литература') {
      askQuestions(ctx, 'literature');
    } else if (message === '2' || message === 'наука') {
      askQuestions(ctx, 'science');
    } else {
      ctx.reply('Неизвестная тема. Пожалуйста, выберите 1 для Литературы или 2 для Науки.');
    }
  });
}

// Функция для задавания вопросов
async function askQuestions(ctx, category) {
  const questions = questionsData[category];
  if (!questions || questions.length === 0) {
    ctx.reply('Нет вопросов для выбранной темы.');
    return;
  }

  let currentQuestionIndex = 0;
  let quizEnded = false;

  // Функция для отправки следующего вопроса
  const askNextQuestion = () => {
    if (currentQuestionIndex < questions.length) {
      const question = questions[currentQuestionIndex];
      ctx.reply(question.question);

      // Таймер ожидания ответа (первые 30 секунд)
      setTimeout(() => {
        if (!question.answered) {
          ctx.reply(`Время вышло! Вот подсказка: первый символ правильного ответа — '${question.answer.charAt(0)}'`);
          
          // Дополнительное время для ответа (еще 30 секунд)
          setTimeout(() => {
            if (!question.answered) {
              ctx.reply(`Время истекло, правильный ответ: ${question.answer}`);
              currentQuestionIndex++;
              askNextQuestion(); // Переход к следующему вопросу
            }
          }, 30000); // 30 секунд на ответ после подсказки
        }
      }, 30000); // 30 секунд на первый ответ
    } else {
      ctx.reply('Викторина завершена!');
      quizEnded = true;
    }
  };

  // Начинаем задавать вопросы
  askNextQuestion();

  // Слушаем ответы пользователей
  bot.on('text', (ctx) => {
    if (quizEnded) return; // Если викторина завершена, не обрабатываем ответы

    const question = questions[currentQuestionIndex];
    if (ctx.message.text.toLowerCase() === question.answer.toLowerCase()) {
      question.answered = true; // Отметим, что вопрос был отвечен
      ctx.reply(`Правильный ответ: ${question.answer}! Поздравляем!`);
      
      currentQuestionIndex++; // Переходим к следующему вопросу
      askNextQuestion(); // Переход к следующему вопросу
    }
  });
}

// Обработчик команды /start
bot.command('start', (ctx) => {
  startQuiz(ctx);
});

// Запуск бота
bot.launch();

// Обработка ошибок
bot.catch((err) => {
  console.error('Ошибка бота', err);
});
