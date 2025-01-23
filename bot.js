const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const bot = new Telegraf('YOUR_BOT_TOKEN'); // Замените на ваш токен

// Загружаем вопросы из файла
const questionsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json')));

// Загружаем или создаем файл статистики
const statsFilePath = path.join(__dirname, 'stats.json');
let playerScores = {};
if (fs.existsSync(statsFilePath)) {
  playerScores = JSON.parse(fs.readFileSync(statsFilePath));
} else {
  fs.writeFileSync(statsFilePath, JSON.stringify({}));
}

// Структура для хранения состояния викторины
let currentTopic = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let activeQuestionTimer = null;
let unansweredQuestions = 0; // Счетчик подряд пропущенных вопросов
const maxUnansweredQuestions = 3; // Лимит на завершение викторины
let quizActive = false; // Флаг активности викторины

// Функция для сохранения статистики в файл
function saveStats() {
  fs.writeFileSync(statsFilePath, JSON.stringify(playerScores, null, 2));
}

// Функция для начала викторины
async function startQuiz(ctx) {
  if (quizActive) {
    ctx.reply('Викторина уже идет. Подождите завершения текущей.');
  } else {
    quizActive = true;
    unansweredQuestions = 0;
    currentTopic = null;
    currentQuestions = [];
    currentQuestionIndex = 0;
    ctx.reply('Выберите тему викторины:\n1. Литература\n2. Наука');
  }
}

// Слушаем текстовые сообщения
bot.on('text', (ctx) => {
  if (!quizActive) return; // Игнорируем сообщения, если викторина не активна

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
      unansweredQuestions = 0; // Сбрасываем счетчик пропущенных вопросов

      // Подсчет очков за скорость
      const responseTime = 30 - currentQuestion.remainingTime; // Время, затраченное на ответ
      const points = responseTime <= 10 ? 3 : responseTime <= 20 ? 2 : 1;

      // Обновляем очки игрока
      if (!playerScores[username]) playerScores[username] = 0;
      playerScores[username] += points;
      saveStats();

      ctx.reply(`Правильный ответ: ${currentQuestion.answer}! Вы получаете ${points} очков!`);
      currentQuestionIndex++;
      setTimeout(() => {
        askNextQuestion(ctx);
      }, 3000); // 3 секунды задержки перед следующим вопросом
    } else {
      ctx.reply(''); // Игнорируем неправильный ответ
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
    quizActive = false;
    return;
  }

  // Выбираем случайные вопросы
  currentQuestions = getRandomQuestions(questions, 5);

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
        unansweredQuestions++;
        currentQuestionIndex++;

        if (unansweredQuestions >= maxUnansweredQuestions) {
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
  currentTopic = null;
  currentQuestions = [];
  currentQuestionIndex = 0;
  unansweredQuestions = 0;
  quizActive = false;
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
