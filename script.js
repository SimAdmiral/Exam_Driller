// This file contains all the JavaScript logic for the quiz.

// DOM Elements
const questionNumberEl = document.querySelector(".question-number");
const questionTextEl = document.querySelector(".question-text");
const optionContainerEl = document.querySelector(".option-container");
const answersIndicatorContainerEl = document.querySelector(".answers-indicator");
const homeBox = document.querySelector(".home-box");
const quizBox = document.querySelector(".quiz-box");
const resultBox = document.querySelector(".result-box");
const submitBtn = document.querySelector(".submit-answer-btn");
const reviewContainerEl = resultBox.querySelector(".review-container");
const topicSelect = document.getElementById("topic");
const topicSelectContainer = document.getElementById("topic-select-container"); // New container reference
const timerDisplayEl = document.querySelector(".timer-display");
const totalQuestionsHomeEl = homeBox.querySelector(".total-question-home");
const quizTimeHomeEl = homeBox.querySelector(".quiz-time-home");

 // Get references to shuffle buttons and custom time input
const shuffleButtons = document.querySelectorAll('.shuffle-buttons .btn'); // Get all shuffle buttons
const shuffleQuestionsButton = shuffleButtons[0]; // Assuming 'Shuffle Questions' is the first button
const shuffleAnswersButton = shuffleButtons[1]; // Assuming 'Shuffle Answers' is the second button
const customTimeInput = document.getElementById('custom-time-minutes');
const questionFileInput = document.getElementById('question-file-input'); // New file input reference
const uploadStatusEl = document.getElementById('upload-status'); // New upload status element


// Quiz State Variables
let currentQuizData = []; // All questions for the selected topic (built-in)
let customQuizData = null; // Stores the uploaded custom quiz data (array of question objects) - null if using built-in
let selectedQuestions = []; // Questions chosen and potentially re-ordered for the current quiz session
let currentIndex = 0;
// correctAnswers and attempt were used for submitted questions only.
// We calculate final results based on the state of all questions in quizOver.
// These submitted counts are no longer used for the final result but kept for clarity if needed elsewhere.
let correctAnswersSubmitted = 0; // Correct answers among submitted questions (legacy)
let attemptSubmitted = 0; // Count of questions where Submit was clicked (legacy)

// Timer Variables
const DEFAULT_TIME_IN_SECONDS = 600; // 10 minutes default
let timeLeft = DEFAULT_TIME_IN_SECONDS;
let timerInterval;
let quizStartTimeSeconds = DEFAULT_TIME_IN_SECONDS; // Store the actual time the quiz started with


// --- Utility Functions ---

// Fisher-Yates (Knuth) Shuffle Algorithm
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}

// Formats time from seconds to MM:SS
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');
    return `${formattedMinutes}:${formattedSeconds}`;
}

 // Compares two arrays for equality after sorting (used to check if user selection matches correct answer)
 function areArraysEqualSorted(arr1, arr2) {
     // Ensure both are arrays and not null/undefined
     if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
     if (arr1.length !== arr2.length) return false;
     // Compare sorted versions
     const sortedArr1 = [...arr1].sort((a, b) => a - b);
     const sortedArr2 = [...arr2].sort((a, b) => a - b);
     for (let i = 0; i < sortedArr1.length; i++) {
         if (sortedArr1[i] !== sortedArr2[i]) return false;
     }
     return true;
 }

 // Basic validation for a single question object structure
 function isValidQuestion(q, index) {
     let errors = [];
     if (typeof q !== 'object' || q === null) errors.push("not an object or null");
     if (typeof q.q !== 'string' || q.q.trim() === '') errors.push("missing or empty 'q' (question text)");
     if (!Array.isArray(q.options) || q.options.length < 1) errors.push("'options' must be an array with at least one item");
     if (!Array.isArray(q.answer)) errors.push("'answer' must be an array");

      if (Array.isArray(q.options) && Array.isArray(q.answer)) {
         // Validate answer indices if options and answer arrays exist
         if (!q.answer.every(idx => typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 && idx < q.options.length)) {
              // If any index is invalid
             if (q.answer.length > 0) { // Only report if answer array is not empty
                 errors.push("invalid index/indices in 'answer' array (must be 0-based indices within options)");
             }
         }
      }

      // Optional properties checks (img, topic, isCodeImage)
      if (q.img !== undefined && typeof q.img !== 'string') errors.push("'img' must be a string (file path)");
      if (q.topic !== undefined && typeof q.topic !== 'string') errors.push("'topic' must be a string");
      if (q.isCodeImage !== undefined && typeof q.isCodeImage !== 'boolean') errors.push("'isCodeImage' must be a boolean (true/false)");
      if (q.isCodeImage === true && !q.img) errors.push("has 'isCodeImage: true' but missing 'img' path");


     if (errors.length > 0) {
         console.warn(`Validation failed for question at index ${index}:`, q, "\nErrors:", errors.join(", "));
         return false; // Not valid
     }
     return true; // Valid
 }


 // Handles loading and validating a JSON file
 function loadCustomQuestions(file) {
     if (!file) {
         console.log("No file selected.");
         uploadStatusEl.textContent = "No file selected.";
         uploadStatusEl.className = "";
         customQuizData = null; // Ensure no custom data is loaded
         prepareQuizQuestionsForSession(); // Fallback to built-in data
         return;
     }

     console.log("Attempting to load file:", file.name);
     uploadStatusEl.textContent = "Loading...";
     uploadStatusEl.className = "";
     customQuizData = null; // Clear previous custom data while loading

     const reader = new FileReader();

     reader.onload = function(event) {
         try {
             const fileContent = event.target.result;
             const parsedData = JSON.parse(fileContent);

             // --- Validation ---
             if (!Array.isArray(parsedData)) {
                 throw new Error("JSON content must be a top-level array.");
             }

             if (parsedData.length === 0) {
                  throw new Error("JSON array is empty. Please provide at least one question.");
             }

             // Validate each item in the array, keep only valid ones
             const validQuestions = parsedData.filter(isValidQuestion);

             if (validQuestions.length === 0) {
                  throw new Error(`No valid questions found in the JSON file (${parsedData.length} items processed).`);
             }

              if (validQuestions.length !== parsedData.length) {
                 console.warn(`Warning: Only ${validQuestions.length} out of ${parsedData.length} questions in the JSON file were valid and were loaded.`);
              }


             // Validation successful
             customQuizData = validQuestions;
             console.log("Custom questions loaded successfully:", customQuizData.length, "questions.");
             uploadStatusEl.textContent = `Loaded ${customQuizData.length} custom questions from "${file.name}".`;
             uploadStatusEl.className = "success";

             // Disable topic select and trigger quiz preparation with custom data
             topicSelectContainer.classList.add('hide'); // Hide the topic select
             topicSelect.disabled = true; // Disable the select element itself

             prepareQuizQuestionsForSession(); // Prepare the quiz list using the custom data


         } catch (error) {
             console.error("Error loading or parsing JSON file:", error);
             customQuizData = null; // Ensure custom data is not set if there's an error
             uploadStatusEl.textContent = `Error loading questions from "${file.name}": ${error.message}`;
             uploadStatusEl.className = "error";
              // Reset file input value so the same file can be selected again
             questionFileInput.value = '';

              // Ensure topic select is visible and enabled again
             topicSelectContainer.classList.remove('hide');
             topicSelect.disabled = false;
             // Re-prepare using default data after failure
             prepareQuizQuestionsForSession(); // This will load default data and update home display
         }
     };

     reader.onerror = function() {
          console.error("Error reading file:", reader.error);
          customQuizData = null;
          uploadStatusEl.textContent = `Error reading file "${file.name}": ${reader.error.message}`;
          uploadStatusEl.className = "error";
           // Reset file input value
          questionFileInput.value = '';
           // Ensure topic select is visible and enabled again
          topicSelectContainer.classList.remove('hide');
          topicSelect.disabled = false;
          // Re-prepare using default data after failure
          prepareQuizQuestionsForSession();
     };

     reader.readAsText(file); // Start reading the file as text
 }


// --- Timer Functions ---

// Starts the timer with the current value of timeLeft
function startTimer() {
    updateTimerDisplay(); // Display initial time immediately
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 60 && !timerDisplayEl.classList.contains('warning') && !timerDisplayEl.classList.contains('critical')) {
         timerDisplayEl.classList.add('warning');
    }
     if (timeLeft <= 10 && !timerDisplayEl.classList.contains('critical')) {
         timerDisplayEl.classList.remove('warning'); // Remove warning if critical
         timerDisplayEl.classList.add('critical');
    }
     if (timeLeft > 60) {
          timerDisplayEl.classList.remove('warning', 'critical');
     }

    if (timeLeft <= 0) {
        stopTimer();
        if (!quizBox.classList.contains('hide')) {
           quizOver(); // End quiz if time runs out while in quiz box
        }
    }
}

function stopTimer() {
    clearInterval(timerInterval);
}

function updateTimerDisplay() {
    timerDisplayEl.textContent = `Time left: ${formatTime(timeLeft)}`;
}

// --- Quiz Setup & Logic Functions ---

function filterQuestionsByTopic() {
    const selectedTopic = topicSelect.value;
    if (selectedTopic === 'all') {
        currentQuizData = [...allQuizData]; // Copy all questions
    } else {
        currentQuizData = allQuizData.filter(q => q.topic === selectedTopic);
    }
     console.log(`Built-in data filtered by topic "${selectedTopic}". Count: ${currentQuizData.length}`);
}

// Toggles the highlight for "Shuffle Questions" button
function toggleShuffleQuestions(buttonElement) {
    if (buttonElement) {
        buttonElement.classList.toggle('highlight-btn');
        console.log(`Shuffle Questions button toggled. Class List: ${buttonElement.classList.value}`); // Log class list
    }
    prepareQuizQuestionsForSession();
}

 // Toggles the highlight for "Shuffle Answers" button
function toggleShuffleAnswers(buttonElement) {
    if (buttonElement) {
        buttonElement.classList.toggle('highlight-btn');
        console.log(`Shuffle Answers button toggled. Class List: ${buttonElement.classList.value}`); // Log class list
    }
    prepareQuizQuestionsForSession();
}


// Prepares the questions for a quiz session based on custom data OR built-in data + topic filter, and shuffle settings
// Note: This function does NOT reset quiz state variables like currentIndex, correctAnswersSubmitted, attemptSubmitted.
// It is called by topic change and shuffle button toggles to update the question list on the home screen.
function prepareQuizQuestionsForSession() {
    console.log("Preparing quiz questions list...");

    let sourceData;
    if (customQuizData !== null && customQuizData.length > 0) {
        console.log("Using custom quiz data as source.");
        sourceData = customQuizData; // Use the validated custom data directly (no need to filter by topic)
    } else {
        console.log("Using built-in quiz data as source.");
        filterQuestionsByTopic(); // Filter the built-in data based on topic select
        sourceData = currentQuizData; // Use the filtered built-in data
    }


    if (!sourceData || sourceData.length === 0) {
        selectedQuestions = []; // Clear if no questions found
        updateHomeDisplay(); // Update display to 0 questions
        console.log("No questions available from source data.");
        return false; // Indicate no questions were set
    }

     // Always work with a deep copy of the source data for the current session
    let questionsToPrepare = sourceData.map(q => {
         // Create a deep copy of the question object
         const questionCopy = JSON.parse(JSON.stringify(q));
         // Ensure properties used during the quiz are present and reset
         questionCopy.userSelected = []; // Reset user selection
         questionCopy.answered = false; // Reset answered state (Submit button not yet clicked)

         // Generate initial shuffled pairs *once* when preparing the question copy
         const originalOptionPairs = questionCopy.options.map((text, originalIdx) => ({ originalIdx, text }));
         // Decide initial shuffling of options based on shuffleAnswersButton state
         const shuffleAnswersEnabled = shuffleAnswersButton.classList.contains('highlight-btn');
         if (shuffleAnswersEnabled) {
              questionCopy.shuffledOptionPairs = shuffleArray([...originalOptionPairs]); // Shuffle a copy
         } else {
              questionCopy.shuffledOptionPairs = originalOptionPairs; // Keep original order
         }

         return questionCopy;
     });


    // Determine if question order shuffle is enabled
    const shuffleQuestionsEnabled = shuffleQuestionsButton.classList.contains('highlight-btn');

    // Shuffle the questions array (order of questions) if enabled
    if (shuffleQuestionsEnabled) {
        shuffleArray(questionsToPrepare);
         console.log("Question order shuffled.");
    } else {
         console.log("Question order not shuffled (shuffle questions not highlighted).");
    }

    selectedQuestions = questionsToPrepare; // Set the prepared questions list

    updateHomeDisplay(); // Update the question count and time on the home screen
    console.log("Quiz questions list prepared:", selectedQuestions.length, "questions.");
    return true; // Indicate questions were successfully set
}

// Updates the display on the home screen including custom time and question count
function updateHomeDisplay() {
     totalQuestionsHomeEl.innerHTML = selectedQuestions.length + "";

     // Read custom time input and update displayed time
     const customMinutes = parseInt(customTimeInput.value);
     let timeToDisplaySeconds;
     if (!isNaN(customMinutes) && customMinutes > 0) {
         timeToDisplaySeconds = customMinutes * 60;
     } else {
         timeToDisplaySeconds = DEFAULT_TIME_IN_SECONDS;
     }
     quizTimeHomeEl.innerHTML = formatTime(timeToDisplaySeconds);
 }


function loadQuestion(index) {
  console.log("Loading question index:", index);
  if (index < 0 || index >= selectedQuestions.length) {
      console.error("Invalid question index:", index);
      return; // Prevent errors if index is out of bounds
  }

  currentQuestion = selectedQuestions[index];

  questionNumberEl.innerHTML = "Question " + (index + 1) + " of " + selectedQuestions.length;

  // Clear previous content
  questionTextEl.innerHTML = "";

  // Create a container for the image and text to maintain order
  const contentContainer = document.createElement("div"); // Use a div to hold both image and text

  // Handle code image first if specified
  if (currentQuestion.img && currentQuestion.isCodeImage) {
      const img = document.createElement("img");
      img.src = currentQuestion.img;
      img.alt = "Code snippet"; // Generic alt text for code images
      // Add styling via CSS class instead of inline styles
      // img.classList.add('code-image-style'); // Add a class if needed for specific code image styling
      contentContainer.appendChild(img);
  }

  // Add the question text
  const text = document.createElement("div");
  // Use innerHTML for potential <br> or simple formatting within q property
  text.innerHTML = currentQuestion.q;
  contentContainer.appendChild(text);

  // Handle standard question image after text if not a code image
  if (currentQuestion.img && !currentQuestion.isCodeImage) {
      const img = document.createElement("img");
      img.src = currentQuestion.img;
      img.alt = "Question Image"; // Standard alt text
      // img.classList.add('standard-image-style'); // Add a class if needed
      contentContainer.appendChild(img);
  }

  // Append the combined content to the main question text element
  questionTextEl.appendChild(contentContainer);


  optionContainerEl.innerHTML = ""; // Clear previous options

  // Use the shuffledOptionPairs array generated during quiz preparation
  const optionsToDisplay = currentQuestion.shuffledOptionPairs;

  // Loop through the shuffled option pairs to display options as checkboxes
  optionsToDisplay.forEach(pair => {
        const optionWrapper = document.createElement("div"); // Wrapper for styling
        optionWrapper.className = "option-item";
        // Store the original index on the wrapper element
        optionWrapper.setAttribute("data-original-id", pair.originalIdx);

        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        // checkbox.value could store originalIdx, but data attribute is sufficient
        // checkbox.value = pair.originalIdx;

        const optionTextSpan = document.createElement("span");
        optionTextSpan.textContent = pair.text; // Use textContent for safety

        label.appendChild(checkbox);
        label.appendChild(optionTextSpan);
        optionWrapper.appendChild(label);
        optionContainerEl.appendChild(optionWrapper);

        // Add change listener to the checkbox
        checkbox.addEventListener('change', handleOptionChange);

        // Restore previous selection state if any
        if (currentQuestion.userSelected?.includes(pair.originalIdx)) {
            checkbox.checked = true;
            // Apply 'option-checked' class only if selected and NOT already answered (styling conflict)
            if (!currentQuestion.answered) {
                 optionWrapper.classList.add("option-checked"); // Add class for styling if not submitted
            }
        }

        // If question was already answered (submitted), mark options and disable clicking
        if (currentQuestion.answered) {
            optionWrapper.classList.add("already-answered"); // Disable clicks via pointer-events
            checkbox.disabled = true; // Disable the checkbox
            // Apply correct/wrong classes based on submission outcome
            // The logic here determines the *per-option* feedback after submission
            const originalId = parseInt(optionWrapper.getAttribute("data-original-id")); // Need originalId here too
            if (currentQuestion.answer.includes(originalId)) {
              optionWrapper.classList.add("correct"); // Mark correct options (whether selected or not)
            }
            // Also mark selected options that were WRONG in submitted questions
            if (currentQuestion.userSelected?.includes(originalId) && !currentQuestion.answer.includes(originalId)) {
               optionWrapper.classList.add("wrong");
            }
             // Remove the checkmark style if it was a wrong submission (already handled by wrong class, but explicit remove)
             if (optionWrapper.classList.classList.contains("wrong")) {
                      optionWrapper.classList.remove("option-checked");
                 }
        }
  });

  // Show/hide submit button
  if (!currentQuestion.answered) {
    submitBtn.classList.remove("hide");
  } else {
    submitBtn.classList.add("hide");
  }

   console.log(`Question ${index + 1} loaded. Answered (submitted): ${currentQuestion.answered}, User Selected:`, currentQuestion.userSelected);
}

// Handler for checkbox change event
function handleOptionChange(event) {
    const checkbox = event.target;
    // Get original ID from the parent wrapper element
    const optionWrapper = checkbox.closest('.option-item');
    if (!optionWrapper) return; // Should not happen if structure is correct

    const originalId = parseInt(optionWrapper.getAttribute("data-original-id"));
    const isChecked = checkbox.checked;

    // Ensure userSelected exists
    if (!currentQuestion.userSelected) {
        currentQuestion.userSelected = [];
    }
    const selected = currentQuestion.userSelected;

    if (isChecked) {
        if (!selected.includes(originalId)) { // Prevent duplicates
            selected.push(originalId);
            // Add 'option-checked' class when selected (and not submitted)
             if (!currentQuestion.answered) {
                 optionWrapper.classList.add("option-checked");
             }
        }
    } else {
        const indexToRemove = selected.indexOf(originalId);
        if (indexToRemove > -1) {
            selected.splice(indexToRemove, 1);
             // Remove 'option-checked' class when unchecked (and not submitted)
            if (!currentQuestion.answered) {
                optionWrapper.classList.remove("option-checked");
            }
        }
    }
     console.log(`Option ${originalId} changed to ${isChecked}. Current selected (original IDs) for Q${currentIndex+1}:`, currentQuestion.userSelected);
}


function submitAnswer() {
  console.log("Submitting answer for question", currentIndex + 1);
  // Check if any option is selected before allowing submission
  if (!currentQuestion.userSelected || currentQuestion.userSelected.length === 0) {
      alert("Please select at least one option before submitting.");
      return; // Prevent submission if nothing is selected
  }

  if (currentQuestion.answered) return; // Prevent double submission

  const correct = currentQuestion.answer; // Array of correct original indices
  const selected = currentQuestion.userSelected || []; // Array of user's selected original indices

  // Check if the submitted answer is correct (all correct selected, no wrong ones selected)
  const sortedSelected = [...selected].sort((a, b) => a - b);
  const sortedCorrect = [...correct].sort((a, b) => a - b);
  const isCorrect = areArraysEqualSorted(sortedSelected, sortedCorrect);

  console.log("User Selected:", selected, "Correct Answer:", correct, "Is Correct:", isCorrect);

  // Mark the options on the display and disable clicking
  optionContainerEl.querySelectorAll('.option-item').forEach(itemEl => {
    const originalId = parseInt(itemEl.getAttribute("data-original-id"));
    const checkbox = itemEl.querySelector('input[type="checkbox"]');

    // These classes are applied *after* submission to show immediate feedback
    if (correct.includes(originalId)) {
      itemEl.classList.add("correct"); // Mark correct options (whether selected or not)
    }
    // Also mark selected options that are WRONG
    if (selected.includes(originalId) && !correct.includes(originalId)) {
       itemEl.classList.add("wrong");
    }

    itemEl.classList.add("already-answered"); // Add general answered style/disable
    checkbox.disabled = true; // Disable checkbox
    itemEl.querySelector('label').style.cursor = 'default'; // Change cursor

    // Remove 'option-checked' class after submit as 'correct'/'wrong' takes over styling
    itemEl.classList.remove("option-checked");
  });

  currentQuestion.answered = true; // Mark question as answered (submitted)

  // We no longer track submitted counts globally for the final score.

  submitBtn.classList.add("hide"); // Hide submit button

   // Re-create indicators to reflect the change for the current question (now based on question.answered state)
  createAnswerIndicators();
   console.log(`Answer submitted for Q${currentIndex+1}. Question marked as answered.`);

   // Navigation to next question is handled by user clicking the 'Next' button
}

function createAnswerIndicators() {
  console.log("Creating answer indicators for", selectedQuestions.length, "questions.");
  answersIndicatorContainerEl.innerHTML = "";
   const numQuestions = selectedQuestions.length;
  for (let i = 0; i < numQuestions; i++) {
    const indicator = document.createElement("div");
    const question = selectedQuestions[i];
    // Check if question was previously answered (submitted) to set indicator color
    // Indicators only show state for *submitted* questions based on current logic.
    // Skipped questions remain grey.
    if(question?.answered) { // Use optional chaining just in case
         const selected = question.userSelected || [];
         const correct = question.answer;

          const sortedSelected = [...selected].sort((a, b) => a - b);
          const sortedCorrect = [...correct].sort((a, b) => a - b);

          const isCorrect = areArraysEqualSorted(sortedSelected, sortedCorrect);

        indicator.classList.add(isCorrect ? 'correct' : 'wrong');
    } else {
        // If not answered (submitted), the indicator remains grey ('#ddd' default background)
        // This visually distinguishes submitted vs. unsubmitted questions in the indicator bar.
        // We could add another color here if we wanted indicators to show 'partially attempted' state.
    }
    answersIndicatorContainerEl.appendChild(indicator);
  }
   console.log("Indicators created/updated.");
}


function next() {
  console.log("Next button clicked. Current index:", currentIndex);

  // Allow navigation regardless of whether the current question was submitted
  if (currentIndex < selectedQuestions.length - 1) {
      currentIndex++;
      loadQuestion(currentIndex);
      createAnswerIndicators(); // Re-create indicators on navigation
       console.log("Moving to next question:", currentIndex + 1);
  } else {
      // If it's the last question, clicking 'Next' signifies finishing the quiz
      console.log("On last question, finishing quiz.");
      quizOver(); // Call quizOver directly
  }
}

function prev() {
  console.log("Prev button clicked. Current index:", currentIndex);
  if (currentIndex > 0) {
    currentIndex--;
    loadQuestion(currentIndex);
    createAnswerIndicators(); // Re-create indicators on navigation
  }
}

function quizOver() {
  console.log("Quiz Over called.");
  stopTimer(); // Stop the timer when the quiz ends

  // Add a log right before attempting to hide/show boxes
   console.log("Attempting to hide quiz box and show result box...");
   quizBox.classList.add("hide"); // Hide quiz box
   resultBox.classList.remove("hide"); // Show result box
   console.log("Quiz box hidden, result box made visible.");

  try { // Add try block here to catch errors during result processing *after* showing the result box
    console.log("Calculating final results...");
    // --- Calculate Final Results across ALL questions ---
    let finalTotalCorrect = 0;
    let finalTotalAttempted = 0; // Attempted if submitted OR selections made
    let finalTotalWrong = 0;

    if (selectedQuestions.length === 0) {
         console.warn("Quiz ended, but selectedQuestions array is empty. Results will be 0.");
    } else {
         selectedQuestions.forEach(question => {
             const userSelected = question.userSelected || [];
             const correct = question.answer;

             // Check if the user's selections exactly match the correct answer(s)
             const isCorrectSelection = areArraysEqualSorted(userSelected, correct);

             // Determine if the question was "attempted" based on the new definition
             // Attempted if submit was clicked OR if the user made *any* selection
             const wasAttempted = question.answered || userSelected.length > 0;

             if (wasAttempted) {
                 finalTotalAttempted++;
                 if (isCorrectSelection) {
                     finalTotalCorrect++;
                 } else {
                     finalTotalWrong++;
                 }
             }
             // Questions not attempted (neither submitted nor selections made) are implicitly skipped.
             // These don't count towards attempted/correct/wrong based on the scoring logic.
         });
    }


     console.log(`Final Calculation: Total Q: ${selectedQuestions.length}, Attempted: ${finalTotalAttempted}, Correct: ${finalTotalCorrect}, Wrong: ${finalTotalWrong}`);

    // Update Result Box with final calculated numbers
    quizResult(selectedQuestions.length, finalTotalAttempted, finalTotalCorrect, finalTotalWrong); // Populate the table
    console.log("quizResult function called and finished."); // Log after calling

    // Show the review for all questions
    showAnswerReview(); // Populate the review container
    console.log("showAnswerReview function called and finished."); // Log after calling


     // Ensure timer display on result screen shows final time/state
     timerDisplayEl.classList.remove('warning', 'critical'); // Clear these for the result screen
     if (timeLeft <= 0) {
          timerDisplayEl.textContent = "Time's up!"; // Display "Time's up!" if it ended due to time
          timerDisplayEl.classList.add('critical'); // Maybe keep critical color
     } else {
         const timeTaken = quizStartTimeSeconds - timeLeft; // Use the stored start time
         timerDisplayEl.textContent = `Time taken: ${formatTime(timeTaken)}`; // Show time taken
     }
      console.log("Timer display updated in result box.");

      console.log("Quiz Over completed successfully.");

  } catch (error) {
      console.error("An error occurred during quiz evaluation or result display:", error);
      // The result box is already visible here
      // Clear existing content and add an error message and home button
      resultBox.innerHTML = `<h1>Error</h1><p>An error occurred while trying to show results.</p><p>${error.message}</p><button type="button" class="btn go-home-btn" onclick="goToHome()">Go To Home</button>`;
      alert("An error occurred while processing quiz results. Please check the browser console for details."); // Still show alert
  }
}

// Modified quizResult to accept calculated values
function quizResult(totalQ, attempted, correct, wrong) {
  console.log("Attempting to display quiz results in table.");
  // Ensure elements exist before trying to set innerHTML
   const totalQResultEl = resultBox.querySelector(".total-question-result");
   const totalCorrectEl = resultBox.querySelector(".total-correct");
   const totalAttemptEl = resultBox.querySelector(".total-attempt");
   const totalWrongEl = resultBox.querySelector(".total-wrong");
   const percentageEl = resultBox.querySelector(".percentage");
   const totalScoreEl = resultBox.querySelector(".total-score");


   if (totalQResultEl) totalQResultEl.innerHTML = totalQ;
   if (totalCorrectEl) totalCorrectEl.innerHTML = correct;
   if (totalAttemptEl) totalAttemptEl.innerHTML = attempted;
   if (totalWrongEl) totalWrongEl.innerHTML = wrong; // Use the passed wrong count

  const percentage = (totalQ === 0) ? 0 : (correct / totalQ) * 100; // Avoid division by zero if totalQ is 0
   if (percentageEl) percentageEl.innerHTML = isNaN(percentage) ? "0.00%" : percentage.toFixed(2) + "%"; // isNaN check is also good
   if (totalScoreEl) totalScoreEl.innerHTML = correct + " / " + totalQ; // Score is correct answers / total questions
  console.log("Quiz results table population attempted.");
}

// Show detailed answer review at end
function showAnswerReview() {
  console.log("Generating answer review.");
  reviewContainerEl.innerHTML = "<h3>Answer Review</h3>"; // Clear previous review

  if (selectedQuestions.length === 0) {
      reviewContainerEl.innerHTML += "<p>No questions to review.</p>";
       console.log("No questions to review.");
      return; // Exit if no questions
  }


  selectedQuestions.forEach((question, i) => {
    const div = document.createElement("div");
    div.classList.add("review-question");

    // Question text and image if any
    let html = `<h4>Q${i + 1}: ${question.q}</h4>`;
    // Add the image for the question in the review
    if (question.img) {
         // Use a simple img tag here for review
         html += `<img src="${question.img}" alt="${question.isCodeImage ? 'Code snippet' : 'Question Image'}" style="max-width: 100%; height: auto; margin: 10px 0;">`;
    }


    html += "<ul>"; // Use ul for list structure

    // Use the ORIGINAL options array for review, sorted by original index
    // This ensures the review is predictable regardless of the in-quiz option shuffling
    const originalOptionIndices = Array.from(question.options.keys()).sort((a, b) => a - b);

    originalOptionIndices.forEach(originalIdx => {
       const optText = question.options[originalIdx]; // Get text from original options
       const userSelected = question.userSelected || []; // Get user's selections (will be empty array if none)
       const isCorrectOption = question.answer.includes(originalIdx); // Check if this option is correct (original index)
       const isUserSelected = userSelected.includes(originalIdx); // Check if user selected this option (original index)

       const reviewOptionItem = document.createElement('li'); // Use li for list structure
       let cls = "review-option normal"; // Default class

       // Determine styling class for the list item
       if (isUserSelected && !isCorrectOption) {
           // Scenario: Wrong Option AND User Selected -> Red
           cls = "review-option wrong";
       } else if (isCorrectOption) {
            if (isUserSelected) {
                // Scenario: Correct Option AND User Selected -> Green
                cls = "review-option correct";
            } else {
                // Scenario: Correct Option AND NOT User Selected -> Blue
                cls = "review-option correct-not-selected"; // Use the new class
            }
       }
       // Scenario: Wrong Option AND NOT User Selected -> Default/Normal (handled by initial cls = "review-option normal")


       reviewOptionItem.className = cls;

       const label = document.createElement('label'); // Use a label for better click area
       const checkbox = document.createElement('input');
       checkbox.type = 'checkbox';
       checkbox.disabled = true; // Always disabled in review mode
       if (isUserSelected) {
           checkbox.checked = true; // Set checkbox state based on user's selection
       }

       const span = document.createElement('span');
       span.textContent = optText; // Use textContent for safety

       label.appendChild(checkbox);
       label.appendChild(span);
       reviewOptionItem.appendChild(label);
       html += reviewOptionItem.outerHTML; // Append the generated list item HTML
    });

    html += "</ul>";

    // Add a note about the question state
    const wasAttempted = question.answered || (question.userSelected && question.userSelected.length > 0);
    if (question.answered) {
        // Question was explicitly submitted.
         const userSelected = question.userSelected || [];
         const correct = question.answer;
         const isCorrectSubmission = areArraysEqualSorted(userSelected, correct);
         html += `<p style="font-style: italic; color: #555; margin-top: 5px;">(${isCorrectSubmission ? 'Answer Submitted: Correct' : 'Answer Submitted: Wrong'})</p>`;
    } else if (wasAttempted) {
         // Question was not submitted, but selections were made.
         html += `<p style="font-style: italic; color: #555; margin-top: 5px;">(Answer evaluated on quiz end)</p>`;
    } else { // !question.answered && !wasAttempted
         // Question was not submitted and no selections were made.
         html += `<p style="font-style: italic; color: #555; margin-top: 5px;">(Question skipped entirely)</p>`;
    }


    div.innerHTML = html; // Set the entire innerHTML for the review question div
    reviewContainerEl.appendChild(div);
  });
   console.log("Answer review generated.");
}

// Resets core quiz state variables (used by resetQuiz)
function resetQuizStateVars() {
     currentIndex = 0;
    correctAnswersSubmitted = 0; // Reset submitted counts (legacy)
    attemptSubmitted = 0; // (legacy)
    // Note: selectedQuestions array itself is cleared in resetQuiz
}


function resetQuiz() {
  console.log("Resetting quiz state.");
  stopTimer(); // Ensure timer is stopped
  selectedQuestions = []; // Clear previous questions
  resetQuizStateVars(); // Reset core state variables (scores, index)

  // Reset timer display state - updateHomeDisplay handles setting the default time text
  // timeLeft and quizStartTimeSeconds are set in startQuiz, not reset here

  timerDisplayEl.classList.remove('warning', 'critical'); // Clear styling
  answersIndicatorContainerEl.innerHTML = ""; // Clear indicators
  reviewContainerEl.innerHTML = ""; // Clear review container content

   // Remove highlights from shuffle buttons
   document.querySelectorAll('.shuffle-buttons .btn').forEach(btn => {
            btn.classList.remove('highlight-btn');
            console.log(`Button reset: Removed highlight-btn from ${btn.textContent}`);
   });

   // Reset custom time input to its default value
   customTimeInput.value = '10';

   // Clear custom quiz data and reset the file input
   customQuizData = null;
   questionFileInput.value = ''; // Clear the selected file name in the input
   uploadStatusEl.textContent = ""; // Clear upload status message
   uploadStatusEl.className = "";

   // Ensure topic select is visible and enabled
   topicSelectContainer.classList.remove('hide');
   topicSelect.disabled = false;
   topicSelect.value = 'all'; // Optionally reset topic to 'All Topics'


   console.log("Quiz state reset.");
}

function tryAgain() {
  console.log("Try Again clicked.");
  resultBox.classList.add("hide");
  resetQuiz(); // Reset state (clears highlights, resets custom time input, clears custom data)
  startQuiz(); // Start a new quiz (will now use default data since custom is cleared)
}

function goToHome() {
  console.log("Go To Home clicked.");
  resultBox.classList.add("hide");
  homeBox.classList.remove("hide");
  resetQuiz(); // Reset state (clears highlights, resets custom time input, clears custom data)

  // Prepare questions for home screen display based on topic/defaults (and reset time display)
  // This will now default back to the built-in questions since customQuizData is null
  prepareQuizQuestionsForSession(); // This also calls updateHomeDisplay which reads custom time input
   console.log("Returned to home screen.");
}

function startQuiz() {
  console.log("Start Quiz clicked.");

  // Read and validate custom time input
  const customMinutes = parseInt(customTimeInput.value);
  let quizTimeInSeconds;
  if (!isNaN(customMinutes) && customMinutes > 0) {
      quizTimeInSeconds = customMinutes * 60;
       console.log("Using custom time:", customMinutes, "minutes");
  } else {
      quizTimeInSeconds = DEFAULT_TIME_IN_SECONDS;
      alert(`Invalid or empty time input. Using default time: ${DEFAULT_TIME_IN_SECONDS/60} minutes.`);
       console.log("Using default time:", DEFAULT_TIME_IN_SECONDS/60, "minutes");
       customTimeInput.value = DEFAULT_TIME_IN_SECONDS / 60; // Set input to default if it was invalid
  }

   // Reset quiz state variables *specifically for a new quiz run*
   // This is different from prepareQuizQuestionsForSession which only updates the question list structure.
   resetQuizStateVars(); // Reset score, attempt, index, submitted counts (legacy)
   answersIndicatorContainerEl.innerHTML = ""; // Clear indicators


  // prepareQuizQuestionsForSession sets up the *list* of selectedQuestions based on current topic and shuffle settings.
  // It checks for customQuizData.
  if (!prepareQuizQuestionsForSession()) {
       console.log("Prepare failed. Not starting quiz (no questions loaded).");
       alert("No questions available to start the quiz. Please select a topic or upload valid custom questions.");
       // If prepare failed (no questions), ensure we are back on the home screen and state is reset.
       goToHome(); // Call goToHome to reset everything and show home screen
      return; // Exit if no questions were loaded
  }

  homeBox.classList.add("hide");
  quizBox.classList.remove("hide");

  // Set the time for THIS quiz instance and start the timer
  timeLeft = quizTimeInSeconds;
  quizStartTimeSeconds = quizTimeInSeconds; // Store the duration the quiz started with
  startTimer(); // Start the timer with the calculated time

  createAnswerIndicators(); // Create indicators based on the selected questions (all grey initially for a new quiz)
  loadQuestion(currentIndex); // Load the first question

  console.log("Quiz started.");
}

// Initial setup on page load
window.onload = function () {
    console.log("Window loaded.");

    // Set default value if custom time input is empty on load
    if (!customTimeInput.value) {
         customTimeInput.value = '10'; // Default to 10 minutes
    }

    // Add event listener for topic change
    topicSelect.addEventListener('change', function() {
         console.log("Topic changed.");
         // This listener should only be active when using built-in questions.
         // If custom data is loaded, topicSelect is disabled.
         // When topic changes, re-prepare questions based on the new topic
         // and *current* shuffle settings. Reset quiz state variables BUT NOT highlights/time input/custom data.
         resetQuizStateVars(); // Reset score, attempt, index, submitted counts (legacy)
         answersIndicatorContainerEl.innerHTML = ""; // Clear indicators

         // Highlights and custom time input are intentionally NOT cleared here.
         // Prepare the new list of questions (shuffled according to active settings).
         // prepareQuizQuestionsForSession will use the selected topic from the now-enabled select.
         prepareQuizQuestionsForSession(); // This also calls updateHomeDisplay

         // Optional: Provide feedback to the user
         alert(`Topic changed to "${topicSelect.options[topicSelect.selectedIndex].text}". Quiz state reset (score/progress). Questions/answers shuffled according to current button settings.`);
    });

    // Add event listener for custom time input changes
    customTimeInput.addEventListener('input', function() {
         console.log("Custom time input changed.");
         updateHomeDisplay(); // Just update the displayed time on the home screen based on the input value
    });

    // Add a listener to handle invalid time input on blur (when user clicks out)
     customTimeInput.addEventListener('blur', function() {
          const customMinutes = parseInt(customTimeInput.value);
           if (isNaN(customMinutes) || customMinutes <= 0) {
               alert(`Invalid or empty time input. Please enter a positive number for minutes. Resetting to ${DEFAULT_TIME_IN_SECONDS/60} minutes.`);
               customTimeInput.value = DEFAULT_TIME_IN_SECONDS / 60; // Reset to default
               updateHomeDisplay(); // Update display after reset
           }
     });

     // Add event listener for the custom question file input
     questionFileInput.addEventListener('change', function(event) {
         const file = event.target.files[0]; // Get the selected file
         loadCustomQuestions(file); // Call the function to load and process the file
     });


    // Prepare questions initially when the page loads (filters default data by topic 'all' and applies shuffle settings)
    // This also calls updateHomeDisplay which reads the initial custom time input value and displays it.
    prepareQuizQuestionsForSession();

     console.log("Initial setup complete.");
};