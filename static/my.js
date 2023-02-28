// recog
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
const recognition = new SpeechRecognition()
recognition.interimResults = true
recognition.lang = 'en-US'

// vars
let lastSpoke
let submissionTimeout
let isInitialPrompt = true
let hasAttention = false
let micAllowed = false
let speakersAllowed = false
let responseBubbleColor = '#6c757d'
let responseTextColor = '#ffffff'
let myBubbleColor = '#0d6efd'
let myTextColor = '#ffffff'
let bgColor = '#343a40'
let finalText = ''
let convo = document.getElementById('convo')
let notAllowed = ['Tab','Shift','Control','Alt','CapsLock','Insert','Home','PageUp','PageDown','ArrowUp',
'ArrowDown','ArrowLeft','ArrowRight','Meta','Escape','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11',
'F12','Delete','Backspace',' ']

// mic input
recognition.addEventListener('result', e => {
    const transcript = Array.from(e.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('')

        // only take input after name has been called
        if (transcript.includes('Hey Joe')) {
            hasAttention = true
            if (isInitialPrompt) {
                createInputMessage('')
            }

            // track final text
            if (e.results[0].isFinal) {
                finalText += transcript + ' '
            }

            // fill the message box with spoken text
            bubble.textContent = transcript.slice(transcript.lastIndexOf('Hey Joe') + 'Hey Joe'.length + 1)
            finalText = bubble.textContent + ' '
    
            // start a new timer before submission
            lastSpoke = Date.now()
            clearTimeout(submissionTimeout)
            submissionTimeout = setTimeout(() => {
                get_response()
            }, 2000)
        }
        else if (hasAttention) {
            // fill message with spoken text
            bubble.textContent = finalText + ' ' + transcript + ' '

            // track final text
            if (e.results[0].isFinal) {
                finalText += transcript + ' '
            }

            // start a new timer before submission
            lastSpoke = Date.now()
            clearTimeout(submissionTimeout)
            submissionTimeout = setTimeout(() => {
                bubble.contentEditable = false;
                get_response()
            }, 2000)
        }
})

// keyboard input
document.addEventListener('keydown', function(e) {
    if (e.key == 'Enter') {
        e.preventDefault()
        lastSpoke = Date.now()
        bubble.contentEditable = false;
        get_response()
    }
    else {
        if (isInitialPrompt) {
            createInputMessage('')
        }

        if (!notAllowed.includes(e.key)) {
            bubble.textContent += e.key
        }
        else if (e.key === ' ') {
            e.preventDefault()
            bubble.innerHTML += ' '
        }
        else if (e.key === 'Backspace') {
            bubble.textContent = bubble.textContent.substring(0, bubble.textContent.length-1)
        }

        if (bubble.textContent === '') {
            convo.removeChild(message)
            isInitialPrompt = true
        }
    }
})

// text response from davinci
function get_response() {
    hasAttention = false
    finalText = ''
    if (bubble.textContent !== '') {
        arg = String(bubble.textContent)
        fetch('/' + arg)
            .then(response => response.text())
            .then(result => {
                // speak response
                if (speakersAllowed) {
                    get_speech(result)
                }

                // add response to screen 
                createResponseMessage(result)
            })
            .catch(error => {
                console.error(error)
            })
    }
    else {
        convo.removeChild(message)
        isInitialPrompt = true
    }
}

// spoken response
function get_speech(result) {
    fetch('/speak/' + result)
        .then(response => response.text())
        .then(result => {
            document.getElementById('sound').play()
        })
        .catch(error => {
            console.error(error)
        })
}

// on screen text bubble
function createInputMessage(text) {
    // message creation
    message = document.createElement('div')
    message.classList.add('d-flex', 'justify-content-end', 'mb-3')

    // p element
    bubble = document.createElement('div')
    bubble.classList.add('card', 'fs-1', 'p-2', 'rounded-4', 'text-wrap', 'myInput')
    bubble.textContent = text
    bubble.style.maxWidth = '70%'
    bubble.style.backgroundColor = myBubbleColor
    bubble.style.color = myTextColor

    // attach to dom
    message.appendChild(bubble)
    convo.appendChild(message)
    scrollToBottom()
    isInitialPrompt = false
}

// on screen response bubble
function createResponseMessage(text) {
    // message creation
    message = document.createElement('div')
    message.classList.add('d-flex', 'justify-content-start', 'mb-3')

    // p element
    bubble = document.createElement('div')
    bubble.classList.add('card', 'fs-1', 'p-2', 'rounded-4', 'text-wrap', 'response')
    bubble.textContent = text
    bubble.style.maxWidth = '70%'
    bubble.style.backgroundColor = responseBubbleColor
    bubble.style.color = responseTextColor

    // attach to dom
    message.appendChild(bubble)
    convo.appendChild(message)
    scrollToBottom()
    isInitialPrompt = true
}

// adjust to bottom (most recent) of convo
function scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight)
}

// user changed settings
function updateSettings() {
    // gather info from modal
    micAllowed = document.getElementById('allowMic').checked
    speakersAllowed = document.getElementById('allowSpeakers').checked
    responseBubbleColor = document.getElementById('responseBubble').value
    responseTextColor = document.getElementById('responseText').value
    myBubbleColor = document.getElementById('myBubble').value
    myTextColor = document.getElementById('myText').value
    bgColor = document.getElementById('bgColor').value

    // gather bubbles
    let responseBubbles = document.getElementsByClassName('response')
    let myBubbles = document.getElementsByClassName('myInput')

    // change colors
    Array.from(responseBubbles).forEach(bubble => {
        bubble.style.backgroundColor = responseBubbleColor
        bubble.style.color = responseTextColor
    })
    Array.from(myBubbles).forEach(bubble => {
        bubble.style.backgroundColor = myBubbleColor
        bubble.style.color = myTextColor
    })
    document.body.style.backgroundColor = bgColor
    document.getElementById('settings-btn').style.backgroundColor = bgColor

    if (micAllowed) {
        recognition.start()
    }
    else {
        recognition.stop()
    }
}

function revertDefault() {
    document.getElementById('responseBubble').value = '#6c757d'
    document.getElementById('responseText').value = '#ffffff'
    document.getElementById('myBubble').value = '#0d6efd'
    document.getElementById('myText').value = '#ffffff'
    document.getElementById('bgColor').value = '#343a40'
}

// show modal on load for user interacting to play audio
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('settings-btn').click()
})

// constant listening
recognition.onend = () => {
    if (micAllowed) {
        recognition.start()
    }
}