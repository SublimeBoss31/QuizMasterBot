const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const bot = new Telegraf('YOUR_BOT_TOKEN'); // Замените на ваш токен

// Загружаем вопросы из файла
const questionsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json')));

// Структура для хранения состояния викторины
let currentTopic = null;
let currentQuestions = [];
let currentQuestionIndex = 0;

// Функция для начала викторины
async function startQuiz(ctx) {
  // Запрашиваем тему викторины, если она еще не выбрана
  if (currentTopic === null) {
    ctx.reply('Выберите тему викторины:\n1. Литература\n2. Наука');
  } else {
    ctx.reply('Тема викторины уже выбрана, подождите пока она завершится.');
  }
}

// Слушаем ответы пользователей
bot.on('text', (ctx) => {
  const message = ctx.message.text.toLowerCase();

  // Обработка выбора темы
  if (currentTopic === null) {
    if (message === '1' || message === 'литература') {
      currentTopic = 'literature';
      askQuestions(ctx, 'literature');
    } else if (message === '2' || message === 'наука') {
      currentTopic = 'science';
      askQuestions(ctx, 'science');
    } else {
      ctx.reply('Неизвестная тема. Пожалуйста, выберите 1 для Литературы или 2 для Науки.');
    }
  } else if (currentQuestions.length > 0) {
    // Обработка ответов на вопросы
    const currentQuestion = currentQuestions[currentQuestionIndex];
    if (message === currentQuestion.answer.toLowerCase()) {
      ctx.reply(`Правильный ответ: ${currentQuestion.answer}! Поздравляем!`);
      currentQuestion.answered = true;
      currentQuestionIndex++;
      if (currentQuestionIndex < currentQuestions.length) {
        setTimeout(() => {
          askNextQuestion(ctx);
        }, 2000); // Ждем 2 секунды перед следующим вопросом
      } else {
        ctx.reply('Викторина завершена!');
        currentTopic = null; // Завершаем викторину
      }
    }
  }
});

// Функция для случайного выбора вопросов
function getRandomQuestions(questions, numQuestions) {
  const selectedQuestions = [];
  const usedIndices = new Set();

  while (selectedQuestions.length < numQuestions) {
    const randomIndex = Math.floor(Math.random() * questions.length);
    if (!usedIndices.has(randomIndex)) {
      usedIndices.add(randomIndex);
      selectedQuestions.push(questions[randomIndex]);
    }
  }
  
  return selectedQuestions;
}

// Функция для задавания вопросов
async function askQuestions(ctx, category) {
  const questions = questionsData[category];
  
  if (!questions || questions.length === 0) {
    ctx.reply('Нет вопросов для выбранной темы.');
    return;
  }

  // Выбираем два случайных вопроса
  currentQuestions = getRandomQuestions(questions, 2);
  
  // Начинаем задавать вопросы
  currentQuestionIndex = 0;
  askNextQuestion(ctx);
}

// Функция для отправки следующего вопроса
const askNextQuestion = (ctx) => {
  if (currentQuestionIndex < currentQuestions.length) {
    const question = currentQuestions[currentQuestionIndex];
    ctx.reply(question.question);
    
    // Первая фаза: 30 секунд на подсказку
    setTimeout(() => {
      if (!question.answered) {
        ctx.reply(`Время вышло на первую фазу! Вот подсказка: первый символ правильного ответа — '${question.answer.charAt(0)}'`);
      }

      // Вторая фаза: 30 секунд на размышление
      setTimeout(() => {
        if (!question.answered) {
          ctx.reply(`Время вышло! Ответ: ${question.answer}`);
        }
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuestions.length) {
          askNextQuestion(ctx); // Переходим к следующему вопросу
        } else {
          ctx.reply('Викторина завершена!');
          currentTopic = null; // Завершаем викторину
        }
      }, 30000); // 30 секунд на размышление после подсказки

    }, 30000); // 30 секунд на первую фазу (подсказка)
  }
};

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