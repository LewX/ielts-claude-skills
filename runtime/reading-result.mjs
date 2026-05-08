import { estimateGtBandFromShortSet } from './reading-band.mjs';

function normalizeAnswerValue(answer) {
  return typeof answer === 'string' ? answer.trim() : answer;
}

function normalizeAnswer(answer) {
  if (Array.isArray(answer)) {
    return answer
      .map(normalizeAnswerValue)
      .filter((item) => item != null && item !== '');
  }

  return normalizeAnswerValue(answer);
}

function answersMatch(userAnswer, correctAnswer) {
  if (Array.isArray(userAnswer) !== Array.isArray(correctAnswer)) {
    return false;
  }

  if (Array.isArray(userAnswer)) {
    const userValues = [...userAnswer].sort();
    const correctValues = [...correctAnswer].sort();

    return (
      userValues.length === correctValues.length &&
      userValues.every((value, index) => value === correctValues[index])
    );
  }

  return userAnswer === correctAnswer;
}

export function deriveReadingResult({ examType, questions, answers }) {
  const derivedQuestions = questions.map((question) => {
    const userAnswer = normalizeAnswer(answers[question.id] ?? '');
    const correctAnswer = normalizeAnswer(question.answerKey);
    const unanswered =
      userAnswer === '' || (Array.isArray(userAnswer) && userAnswer.length === 0);
    const isCorrect = !unanswered && answersMatch(userAnswer, correctAnswer);

    return {
      questionId: question.id,
      questionType: question.type,
      userAnswer: unanswered ? null : userAnswer,
      correctAnswer,
      isCorrect,
      status: unanswered ? 'unanswered' : isCorrect ? 'correct' : 'wrong',
      evidence: question.evidence,
      paraphrasePairs: question.paraphrasePairs,
      explanation: question.explanation,
    };
  });

  const correct = derivedQuestions.filter((question) => question.isCorrect).length;
  const rawScore = { correct, total: derivedQuestions.length };
  const bandEstimate =
    examType === 'general-training'
      ? estimateGtBandFromShortSet(rawScore)
      : { scaledCorrect: null, band: null, label: 'Estimated Band unavailable' };

  return {
    rawScore,
    bandEstimate,
    questions: derivedQuestions,
  };
}
