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
      ctx.reply(`Правильный ответ: ${currentQuestion.answer}! Поздравляем!`);
      currentQuestionIndex++;
      setTimeout(() => {
        askNextQuestion(ctx);
      }, 3000); // 3 секунды задержки перед следующим вопросом
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

  // Выбираем случайные вопросы
  currentQuestions = getRandomQuestions(questions, 2);

  // Начинаем задавать вопросы
  currentQuestionIndex = 0;
  askNextQuestion(ctx);
}

// Функция для отправки следующего вопроса с подсказками и таймером
function askNextQuestion(ctx) {
  if (currentQuestionIndex < currentQuestions.length) {
    const question = currentQuestions[currentQuestionIndex];
    const answerLength = question.answer.length;
    let remainingTime = 30; // Общее время на вопрос

    ctx.reply(`Вопрос: ${question.question} (букв: ${answerLength})`);
    let revealedHint = Array(answerLength).fill('*').join('');
    const hintInterval = 7; // Интервал между подсказками (в секундах)

    // Таймер для показа подсказок
    activeQuestionTimer = setInterval(() => {
      remainingTime -= hintInterval;
      if (remainingTime > 0) {
        // Открываем следующую букву в подсказке
        const nextIndex = revealedHint.indexOf('*');
        if (nextIndex !== -1) {
          revealedHint = revealedHint.substring(0, nextIndex) + question.answer[nextIndex] + revealedHint.substring(nextIndex + 1);
        }
        ctx.reply(`Подсказка: ${revealedHint} (до ответа: ${remainingTime} сек.)`);
      } else {
        clearInterval(activeQuestionTimer); // Останавливаем таймер
        ctx.reply(`Время вышло! Правильный ответ: ${question.answer}`);
        currentQuestionIndex++;
        askNextQuestion(ctx); // Переходим к следующему вопросу
      }
    }, hintInterval * 1000);
  } else {
    ctx.reply('Викторина завершена!');
    currentTopic = null; // Сбрасываем тему
  }
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