import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, ArrowLeft, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const TEST_PASSED_KEY = "house_rules_test_passed";

interface Question {
  id: number;
  rule: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

const questions: Question[] = [
  {
    id: 1,
    rule: "RESPECT",
    question: "How should you address coaches, mentors, and adults at NLA?",
    options: [
      "By their first name",
      "As 'Coach,' 'Sir,' or 'Ma'am'",
      "However you want",
      "You don't need to greet them"
    ],
    correctAnswer: 1
  },
  {
    id: 2,
    rule: "BE ON TIME",
    question: "At NLA, being 'on time' means you arrive:",
    options: [
      "Exactly when practice starts",
      "5 minutes early",
      "15 minutes early",
      "Whenever you can"
    ],
    correctAnswer: 2
  },
  {
    id: 3,
    rule: "BE PREPARED",
    question: "What should you show up with at NLA?",
    options: [
      "Just yourself",
      "The right attitude, equipment, and attire",
      "Only your boxing gloves",
      "Your phone"
    ],
    correctAnswer: 1
  },
  {
    id: 4,
    rule: "SUPPORT YOUR TEAM",
    question: "The gym is described as:",
    options: [
      "A place just for you",
      "A community far bigger than you",
      "Only for the best boxers",
      "A hangout spot"
    ],
    correctAnswer: 1
  },
  {
    id: 5,
    rule: "RESPECT YOUR TEAM",
    question: "If you have an issue with a fellow NLA Boxer, you should:",
    options: [
      "Fight them to settle it",
      "Ignore them forever",
      "Love and correct them, squash the issue immediately",
      "Post about it on social media"
    ],
    correctAnswer: 2
  },
  {
    id: 6,
    rule: "BE CREDIBLE",
    question: "Which of the following is TRUE about being credible at NLA?",
    options: [
      "It's okay to lie sometimes",
      "Tell the entire truth, never lie, and remain accountable",
      "Stealing is allowed if no one sees",
      "Drugs are acceptable"
    ],
    correctAnswer: 1
  },
  {
    id: 7,
    rule: "NO SOCIAL MEDIA",
    question: "Who handles NLA's social media?",
    options: [
      "Any member can post whatever they want",
      "NLA has a social media director to ensure values are never misrepresented",
      "There is no social media policy",
      "Parents handle all posts"
    ],
    correctAnswer: 1
  },
  {
    id: 8,
    rule: "BE A LEADER",
    question: "In the absence of direction, NLA Boxers should:",
    options: [
      "Wait for someone to tell them what to do",
      "Go home",
      "Lead and take action",
      "Sit and watch"
    ],
    correctAnswer: 2
  },
  {
    id: 9,
    rule: "KEEP YOUR HOUSE ORDERLY",
    question: "How often should the gym be cleaned?",
    options: [
      "Once a month",
      "Only when it's dirty",
      "Daily",
      "Never, someone else will do it"
    ],
    correctAnswer: 2
  },
  {
    id: 10,
    rule: "WE ARE NOT VICTIMS",
    question: "According to NLA, how is resiliency developed?",
    options: [
      "Through easy tasks",
      "Through challenging circumstances",
      "By complaining about life",
      "By giving up when things get hard"
    ],
    correctAnswer: 1
  }
];

const HouseRulesTest = () => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [incorrectQuestions, setIncorrectQuestions] = useState<number[]>([]);
  const [passed, setPassed] = useState(false);
  const [retryMode, setRetryMode] = useState(false);

  useEffect(() => {
    // Check if already passed
    const hasPassed = localStorage.getItem(TEST_PASSED_KEY) === "true";
    if (hasPassed) {
      setPassed(true);
    }
  }, []);

  const questionsToShow = retryMode
    ? questions.filter((q) => incorrectQuestions.includes(q.id))
    : questions;

  const handleAnswerChange = (questionId: number, answerIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answerIndex }));
  };

  const handleSubmit = () => {
    const incorrect: number[] = [];
    
    questionsToShow.forEach((q) => {
      if (answers[q.id] !== q.correctAnswer) {
        incorrect.push(q.id);
      }
    });

    setIncorrectQuestions(incorrect);
    setSubmitted(true);

    if (incorrect.length === 0) {
      // All correct!
      localStorage.setItem(TEST_PASSED_KEY, "true");
      setPassed(true);
    }
  };

  const handleRetry = () => {
    // Clear answers for incorrect questions only
    const newAnswers = { ...answers };
    incorrectQuestions.forEach((id) => {
      delete newAnswers[id];
    });
    setAnswers(newAnswers);
    setSubmitted(false);
    setRetryMode(true);
  };

  const allAnswered = questionsToShow.every((q) => answers[q.id] !== undefined);

  if (passed) {
    return (
      <div className="min-h-screen flex flex-col bg-black">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-lg w-full text-center">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 md:p-12">
              <Trophy className="w-20 h-20 text-green-500 mx-auto mb-6" />
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Congratulations!
              </h1>
              <p className="text-lg text-green-400 mb-2">
                You got 10 out of 10 correct!
              </p>
              <p className="text-neutral-300 mb-8">
                You've mastered the NLA House Rules. Proceed to Step 6 to continue your orientation.
              </p>
              <Button
                asChild
                size="lg"
                className="text-white font-bold text-base py-6 px-8"
                style={{ backgroundColor: "#bf0f3e" }}
              >
                <Link to="/rookie-orientation#step-6">
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  Back to Orientation - Step 6
                </Link>
              </Button>
            </div>
          </div>
        </main>
        <Footer className="bg-neutral-950 border-neutral-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Header />
      <main className="flex-1 px-4 py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Link
              to="/rookie-orientation#step-5"
              className="inline-flex items-center text-neutral-400 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orientation
            </Link>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
              HOUSE RULES TEST
            </h1>
            <p className="text-neutral-400">
              {retryMode
                ? `Review and answer the ${incorrectQuestions.length} question${incorrectQuestions.length > 1 ? "s" : ""} you missed.`
                : "Answer all 10 questions correctly to proceed to Step 6."}
            </p>
          </div>

          {/* Results Alert */}
          {submitted && !passed && (
            <Alert className="mb-6 bg-red-500/10 border-red-500/30">
              <XCircle className="h-5 w-5 text-red-500" />
              <AlertDescription className="text-red-300 ml-2">
                You got {questionsToShow.length - incorrectQuestions.length} out of {questionsToShow.length} correct.
                Review your incorrect answers below and try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Questions */}
          <div className="space-y-6">
            {questionsToShow.map((q, index) => {
              const isIncorrect = submitted && incorrectQuestions.includes(q.id);
              const isCorrect = submitted && !incorrectQuestions.includes(q.id);

              return (
                <div
                  key={q.id}
                  className={`bg-neutral-900 border rounded-xl p-5 md:p-6 ${
                    isIncorrect
                      ? "border-red-500/50"
                      : isCorrect
                      ? "border-green-500/50"
                      : "border-neutral-800"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-bold text-white">
                      {retryMode ? index + 1 : q.id}
                    </span>
                    <div>
                      <span className="text-xs font-bold tracking-widest text-neutral-500 uppercase block mb-1">
                        Rule {q.id}: {q.rule}
                      </span>
                      <h3 className="text-white font-semibold">{q.question}</h3>
                    </div>
                  </div>

                  <RadioGroup
                    value={answers[q.id]?.toString()}
                    onValueChange={(value) => handleAnswerChange(q.id, parseInt(value))}
                    className="space-y-2 ml-11"
                    disabled={submitted && !isIncorrect}
                  >
                    {q.options.map((option, optIndex) => {
                      const isSelectedIncorrect =
                        submitted && isIncorrect && answers[q.id] === optIndex;
                      const isTheCorrectAnswer =
                        submitted && isIncorrect && q.correctAnswer === optIndex;

                      return (
                        <div
                          key={optIndex}
                          className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                            isSelectedIncorrect
                              ? "bg-red-500/10 border-red-500/50"
                              : isTheCorrectAnswer
                              ? "bg-green-500/10 border-green-500/50"
                              : "border-neutral-700 hover:border-neutral-600"
                          }`}
                        >
                          <RadioGroupItem
                            value={optIndex.toString()}
                            id={`q${q.id}-opt${optIndex}`}
                            className="border-neutral-500"
                          />
                          <Label
                            htmlFor={`q${q.id}-opt${optIndex}`}
                            className={`flex-1 cursor-pointer ${
                              isSelectedIncorrect
                                ? "text-red-300"
                                : isTheCorrectAnswer
                                ? "text-green-300"
                                : "text-neutral-300"
                            }`}
                          >
                            {option}
                          </Label>
                          {isSelectedIncorrect && (
                            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                          )}
                          {isTheCorrectAnswer && (
                            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </RadioGroup>
                </div>
              );
            })}
          </div>

          {/* Submit / Retry Button */}
          <div className="mt-8 flex justify-center">
            {!submitted ? (
              <Button
                onClick={handleSubmit}
                size="lg"
                className="text-white font-bold text-base py-6 px-12"
                style={{ backgroundColor: "#bf0f3e" }}
                disabled={!allAnswered}
              >
                Submit Answers
              </Button>
            ) : (
              <Button
                onClick={handleRetry}
                size="lg"
                className="text-white font-bold text-base py-6 px-12"
                style={{ backgroundColor: "#bf0f3e" }}
              >
                Try Again
              </Button>
            )}
          </div>

          {!allAnswered && !submitted && (
            <p className="text-center text-neutral-500 mt-4 text-sm">
              Please answer all questions before submitting.
            </p>
          )}
        </div>
      </main>
      <Footer className="bg-neutral-950 border-neutral-800" />
    </div>
  );
};

export default HouseRulesTest;
