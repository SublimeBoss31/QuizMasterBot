const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const bot = new Telegraf('YOUR_BOT_TOKEN'); // Замените на ваш токен

// Загружаем вопросы из файла
const questionsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json')));

// Загружаем или создаем файл статистики
const statsFilePath = path.join(__dirname, 'stats.json');
let chatStats = {};
if (fs.existsSync(statsFilePath)) {
  chatStats = JSON.parse(fs.readFileSync(statsFilePath));
} else {
  fs.writeFileSync(statsFilePath, JSON.stringify({}));
}

// Структура для хранения состояния викторины
let quizState = {}; // Состояние викторины для каждого чата

// Функция для сохранения статистики в файл
function saveStats() {
  fs.writeFileSync(statsFilePath, JSON.stringify(chatStats, null, 2));
}

// Функция для получения состояния викторины для чата
function getQuizState(chatId) {
  if (!quizState[chatId]) {
    quizState[chatId] = {
      currentTopic: null,
      currentQuestions: [],
      currentQuestionIndex: 0,
      unansweredQuestions: 0,
      quizActive: false,
      activeQuestionTimer: null,
    };
  }
  return quizState[chatId];
}

// Функция для начала викторины
async function startQuiz(ctx) {
  const chatId = ctx.chat.id;
  const state = getQuizState(chatId);

  state.quizActive = true; // Активируем викторину
  state.unansweredQuestions = 0; // Сбрасываем счетчик пропущенных вопросов
  state.currentTopic = null;
  state.currentQuestions = [];
  state.currentQuestionIndex = 0;

  ctx.reply('Выберите тему викторины:\n1. Литература\n2. Наука');
}

// Функция для задавания вопросов
async function askQuestions(ctx, category) {
  const chatId = ctx.chat.id;
  const state = getQuizState(chatId);
  const questions = questionsData[category];

  if (!questions || questions.length === 0) {
    ctx.reply('Нет вопросов для выбранной темы.');
    state.quizActive = false;
    return;
  }

  state.currentQuestions = [...questions];
  state.currentTopic = category;
  state.currentQuestionIndex = 0;

  askNextQuestion(ctx);
}

// Функция для отправки следующего вопроса
function askNextQuestion(ctx) {
  const chatId = ctx.chat.id;
  const state = getQuizState(chatId);

  if (state.currentQuestionIndex < state.currentQuestions.length) {
    const question = state.currentQuestions[state.currentQuestionIndex];
    const answerLength = question.answer.length;

    ctx.reply(`Вопрос: ${question.question} (букв: ${answerLength})`);

    let remainingTime = 30;
    state.activeQuestionTimer = setInterval(() => {
      remainingTime -= 5;
      if (remainingTime > 0) {
        const revealed = question.answer.substring(0, 30 - remainingTime);
        ctx.reply(`Подсказка: ${revealed.padEnd(answerLength, '*')} (осталось ${remainingTime} сек.)`);
      } else {
        clearInterval(state.activeQuestionTimer);
        ctx.reply(`Время вышло! Правильный ответ: ${question.answer}`);
        state.unansweredQuestions++;
        state.currentQuestionIndex++;

        if (state.unansweredQuestions >= 3) {
          ctx.reply('Три подряд неотвеченных вопроса. Викторина завершена!');
          endQuiz(ctx);
        } else {
          askNextQuestion(ctx);
        }
      }
    }, 5000);
  } else {
    ctx.reply('Викторина завершена!');
    endQuiz(ctx);
  }
}

// Завершение викторины
function endQuiz(ctx) {
  const chatId = ctx.chat.id;
  const state = getQuizState(chatId);

  state.quizActive = false;
  clearInterval(state.activeQuestionTimer);
}

// Обработчик команды /start
bot.command('start', (ctx) => {
  const chatId = ctx.chat.id;
  const state = getQuizState(chatId);

  if (state.quizActive) {
    ctx.reply('Викторина уже идет. Подождите завершения текущей.');
  } else {
    startQuiz(ctx);
  }
});

// Команда /stat для отображения статистики
bot.command('stat', (ctx) => {
  const chatId = ctx.chat.id;
  if (!chatStats[chatId] || Object.keys(chatStats[chatId]).length === 0) {
    ctx.reply('Никто еще не набрал очков в этом чате.');
  } else {
    const stats = Object.entries(chatStats[chatId])
      .sort((a, b) => b[1] - a[1])
      .map(([username, score], index) => `${index + 1}. ${username}: ${score} очков`)
      .join('\n');
    ctx.reply(`Топ игроков в этом чате:\n${stats}`);
  }
});

// Обработка текстовых сообщений
bot.on('text', (ctx) => {
  const chatId = ctx.chat.id;
  const state = getQuizState(chatId);

  if (!state.quizActive) return;

  const message = ctx.message.text.toLowerCase();
  const username = ctx.message.from.username || ctx.message.from.first_name;

  if (state.currentTopic === null) {
    if (message === '1') {
      askQuestions(ctx, 'literature');
    } else if (message === '2') {
      askQuestions(ctx, 'science');
    } else {
      ctx.reply('Выберите корректную тему: 1 или 2.');
    }
  } else {
    const currentQuestion = state.currentQuestions[state.currentQuestionIndex];
    if (message === currentQuestion.answer.toLowerCase()) {
      clearInterval(state.activeQuestionTimer);
      state.unansweredQuestions = 0;
      updatePlayerScore(chatId, username, 1);
      ctx.reply(`Правильный ответ: ${currentQuestion.answer}!`);
      state.currentQuestionIndex++;
      askNextQuestion(ctx);
    }
  }
});

// Запуск бота
bot.launch();

// Обработка ошибок
bot.catch((err) => console.error('Ошибка бота:', err));