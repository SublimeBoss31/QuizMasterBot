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
      hintCount: 0, // Новое поле для подсказок
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

// Функция для формирования подсказки
function generateHint(answer, revealedCount) {
  return answer
    .split(' ')
    .map(word => {
      return word
        .split('')
        .map((char, index) => (index === 0 || index < revealedCount ? char : '*'))
        .join('');
    })
    .join(' ');
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

// Обновленная функция для задавания следующего вопроса
function askNextQuestion(ctx) {
  const chatId = ctx.chat.id;
  const state = getQuizState(chatId);

  if (state.currentQuestionIndex < state.currentQuestions.length) {
    const question = state.currentQuestions[state.currentQuestionIndex];
    const answer = question.answer;

    state.hintCount = 0; // Сбрасываем подсказки для нового вопроса
    ctx.reply(`Вопрос: ${question.question}`);

    const hintInterval = 10; // Интервал подсказок в секундах
    state.activeQuestionTimer = setInterval(() => {
      if (state.hintCount < 3) { // Не больше трёх подсказок
        const hint = generateHint(answer, state.hintCount + 1); // Открываем на одну букву больше
        ctx.reply(`Подсказка: ${hint}`);
        state.hintCount++;
      } else {
        clearInterval(state.activeQuestionTimer);
        ctx.reply(`Время вышло! Правильный ответ: ${answer}`);
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

// Функция обновления очков игрока
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


// Обработка ответа на текущий вопрос
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
      clearInterval(state.activeQuestionTimer); // Останавливаем таймер
      state.unansweredQuestions = 0; // Сбрасываем счетчик пропущенных вопросов

      // Подсчёт очков за скорость
      const elapsedTime = Math.min(hintCount * hintInterval, maxHints * hintInterval);
      const points = elapsedTime <= 10 ? 3 : 1; // Если ответ дан в первые 10 секунд — 3 очка, иначе — 1

      // Обновляем очки игрока
      updatePlayerScore(chatId, username, points);

      ctx.reply(`Правильный ответ: ${currentQuestion.answer}! Вы получаете ${points} ${points === 1 ? 'очко' : 'очка'}!`);
      state.currentQuestionIndex++;
      setTimeout(() => {
        askNextQuestion(ctx);
      }, 3000); // 3 секунды задержки перед следующим вопросом
    }
  }
});


// Запуск бота
bot.launch();

// Обработка ошибок
bot.catch((err) => console.error('Ошибка бота:', err));
