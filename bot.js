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
let activeQuestionTimer = null;
let unansweredStreak = 0; // Счетчик подряд пропущенных вопросов
const maxUnansweredStreak = 3; // Лимит неправильных попыток
const playerScores = {}; // Объект для хранения очков игроков

// Функция для начала викторины
async function startQuiz(ctx) {
  if (currentTopic === null) {
    ctx.reply('Выберите тему викторины:\n1. Литература\n2. Наука');
  } else {
    ctx.reply('Тема уже выбрана. Подождите завершения текущей викторины.');
  }
}

// Слушаем текстовые сообщения
bot.on('text', (ctx) => {
  const message = ctx.message.text.toLowerCase();
  const username = ctx.message.from.username || ctx.message.from.first_name;

  // Если тема еще не выбрана
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
    // Обработка ответа на текущий вопрос
    const currentQuestion = currentQuestions[currentQuestionIndex];
    if (message === currentQuestion.answer.toLowerCase()) {
      clearTimeout(activeQuestionTimer); // Останавливаем таймер
      unansweredStreak = 0; // Сбрасываем счетчик неправильных попыток

      // Подсчет очков за скорость
      const responseTime = 30 - currentQuestion.remainingTime; // Время, затраченное на ответ
      const points = responseTime <= 10 ? 3 : responseTime <= 20 ? 2 : 1;

      // Обновляем очки игрока
      if (!playerScores[username]) playerScores[username] = 0;
      playerScores[username] += points;

      ctx.reply(`Правильный ответ: ${currentQuestion.answer}! Вы получаете ${points} очков!`);
      currentQuestionIndex++;
      setTimeout(() => {
        askNextQuestion(ctx);
      }, 3000); // 3 секунды задержки перед следующим вопросом
    } else {
      ctx.reply('Неправильный ответ. Попробуйте еще раз!');
      unansweredStreak++;

      if (unansweredStreak >= maxUnansweredStreak) {
        ctx.reply('Три подряд неправильных ответа. Викторина завершена!');
        endQuiz(ctx);
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
      selectedQuestions.push({ ...questions[randomIndex], remainingTime: 30 });
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

  // Выбираем случайные вопросы
  currentQuestions = getRandomQuestions(questions, 5);

  // Начинаем задавать вопросы
  currentQuestionIndex = 0;
  askNextQuestion(ctx);
}

// Функция для отправки следующего вопроса с таймером
function askNextQuestion(ctx) {
  if (currentQuestionIndex < currentQuestions.length) {
    const question = currentQuestions[currentQuestionIndex];
    ctx.reply(`Вопрос: ${question.question}`);

    // Таймер для вопроса
    activeQuestionTimer = setTimeout(() => {
      ctx.reply(`Время вышло! Правильный ответ: ${question.answer}`);
      unansweredStreak++;
      currentQuestionIndex++;

      if (unansweredStreak >= maxUnansweredStreak) {
        ctx.reply('Три подряд неправильных ответа. Викторина завершена!');
        endQuiz(ctx);
      } else {
        askNextQuestion(ctx);
      }
    }, 30000); // 30 секунд на ответ
  } else {
    ctx.reply('Викторина завершена!');
    endQuiz(ctx);
  }
}

// Завершение викторины
function endQuiz(ctx) {
  currentTopic = null;
  currentQuestions = [];
  currentQuestionIndex = 0;
  unansweredStreak = 0;
  clearTimeout(activeQuestionTimer);
}

// Команда /stat для отображения статистики
bot.command('stat', (ctx) => {
  if (Object.keys(playerScores).length === 0) {
    ctx.reply('Никто еще не набрал очков.');
  } else {
    const stats = Object.entries(playerScores)
      .sort((a, b) => b[1] - a[1])
      .map(([username, score], index) => `${index + 1}. ${username}: ${score} очков`)
      .join('\n');
    ctx.reply(`Топ игроков:\n${stats}`);
  }
});

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