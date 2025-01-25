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


// Функция для сохранения очков
function updatePlayerScore(chatId, username, points) {
  if (!chatStats[chatId]) {
    chatStats[chatId] = {};
  }
  if (!chatStats[chatId][username]) {
    chatStats[chatId][username] = 0;
  }
  chatStats[chatId][username] += points;
  saveStats();
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

  state.currentQuestions = getRandomQuestions(questions, 5);
  state.currentTopic = category;
  state.currentQuestionIndex = 0;
  askNextQuestion(ctx);
}

// Функция для отправки следующего вопроса с подсказками
function askNextQuestion(ctx) {
  const chatId = ctx.chat.id;
  const state = getQuizState(chatId);

  if (state.currentQuestionIndex < state.currentQuestions.length) {
    const question = state.currentQuestions[state.currentQuestionIndex];
    const answerLength = question.answer.length;
    let remainingTime = 30;

    ctx.reply(`Вопрос: ${question.question} (букв: ${answerLength})`);
    let revealedHint = Array(answerLength).fill('*').join('');
    const hintInterval = 7;

    state.activeQuestionTimer = setInterval(() => {
      remainingTime -= hintInterval;
      if (remainingTime > 0) {
        const nextIndex = revealedHint.indexOf('*');
        if (nextIndex !== -1) {
          revealedHint = revealedHint.substring(0, nextIndex) + question.answer[nextIndex] + revealedHint.substring(nextIndex + 1);
        }
        ctx.reply(`Подсказка: ${revealedHint} (до ответа: ${remainingTime} сек.)`);
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
    }, hintInterval * 1000);
  } else {
    ctx.reply('Викторина завершена!');
    endQuiz(ctx);
  }
}

// Завершение викторины
function endQuiz(ctx) {
  const chatId = ctx.chat.id;
  const state = getQuizState(chatId);

  state.currentTopic = null;
  state.currentQuestions = [];
  state.currentQuestionIndex = 0;
  state.unansweredQuestions = 0;
  state.quizActive = false;
  clearTimeout(state.activeQuestionTimer);
}

// Обработчик команды /start
bot.command('start', (ctx) => {
  const chatId = ctx.chat.id;
  const state = getQuizState(chatId);

  if (state.quizActive) {
    ctx.reply('Викторина уже идет. Подождите завершения текущей.');
  } else {
    startQuiz(ctx); // Запуск викторины
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

// Слушаем текстовые сообщения
bot.on('text', (ctx) => {
  const chatId = ctx.chat.id; // Идентификатор текущего чата
  const state = getQuizState(chatId); // Получаем состояние викторины для чата

  if (!state.quizActive) return; // Игнорируем сообщения, если викторина не активна

  const message = ctx.message.text.toLowerCase();
  const username = ctx.message.from.username || ctx.message.from.first_name;

  // Если тема еще не выбрана
  if (state.currentTopic === null) {
    if (message === '1' || message === 'литература') {
      state.currentTopic = 'literature';
      askQuestions(ctx, 'literature');
    } else if (message === '2' || message === 'наука') {
      state.currentTopic = 'science';
      askQuestions(ctx, 'science');
    } else {
      ctx.reply('Неизвестная тема. Пожалуйста, выберите 1 для Литературы или 2 для Науки.');
    }
  } else if (state.currentQuestions.length > 0) {
    // Обработка ответа на текущий вопрос
    const currentQuestion = state.currentQuestions[state.currentQuestionIndex];
    if (message === currentQuestion.answer.toLowerCase()) {
      clearTimeout(state.activeQuestionTimer); // Останавливаем таймер
      state.unansweredQuestions = 0; // Сбрасываем счетчик пропущенных вопросов

      // Подсчет очков за скорость
      const responseTime = 30 - currentQuestion.remainingTime; // Время, затраченное на ответ
      const points = responseTime <= 10 ? 3 : responseTime <= 20 ? 2 : 1;

      // Обновляем очки игрока
      if (!playerScores[chatId]) playerScores[chatId] = {};
      if (!playerScores[chatId][username]) playerScores[chatId][username] = 0;
      playerScores[chatId][username] += points;
      saveStats();

      ctx.reply(`Правильный ответ: ${currentQuestion.answer}! Вы получаете ${points} очков!`);
      state.currentQuestionIndex++;
      setTimeout(() => {
        askNextQuestion(ctx);
      }, 3000); // 3 секунды задержки перед следующим вопросом
    } else {
      ctx.reply(''); // Игнорируем неправильный ответ
    }
  }

  ctx.reply(`Текущая тема для чата ${chatId}:`, state.currentTopic);
  ctx.reply(`Состояние викторины:`, state);
});

// Запуск бота
bot.launch();

// Обработка ошибок
bot.catch((err) => {
  console.error('Ошибка бота', err);
});
