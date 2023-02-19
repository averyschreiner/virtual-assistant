window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
const recognition = new SpeechRecognition()
recognition.interimResults = true
recognition.lang = 'en-US'
recognition.start()

let lastSpoke
let submissionTimeout
let isInitialPrompt = true
let hasAttention = false
let finalText = ''
let convo = document.querySelector('.convo-wrapper')
let notAllowed = ['Tab','Shift','Control','Alt','CapsLock','Insert','Home','PageUp','PageDown','ArrowUp',
'ArrowDown','ArrowLeft','ArrowRight','Meta','Escape','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11',
'F12','Delete','Backspace',' ']

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
            p.textContent = transcript.slice(transcript.lastIndexOf('Hey Joe') + 'Hey Joe'.length + 1)
            finalText = p.textContent + ' '
    
            // start a new timer before submission
            lastSpoke = Date.now()
            clearTimeout(submissionTimeout)
            submissionTimeout = setTimeout(() => {
                run_py()
            }, 2000)
        }
        else if (hasAttention) {

            // fill message with spoken text
            p.textContent = finalText + ' ' + transcript + ' '

            // track final text
            if (e.results[0].isFinal) {
                finalText += transcript + ' '
            }

            // start a new timer before submission
            lastSpoke = Date.now()
            clearTimeout(submissionTimeout)
            submissionTimeout = setTimeout(() => {
                run_py()
            }, 2000)
        }
})

document.addEventListener('keydown', function(e) {
    if (e.key == 'Enter') {
        e.preventDefault()
        lastSpoke = Date.now()
        run_py()
    }
    else {
        if (isInitialPrompt) {
            createInputMessage('')
        }

        if (!notAllowed.includes(e.key)) {
            p.textContent += e.key
        }
        else if (e.key === ' ') {
            p.innerHTML += '&nbsp;'
        }
        else if (e.key === 'Backspace') {
            p.textContent = p.textContent.substring(0, p.textContent.length-1)
        }

        if (p.textContent === '') {
            p.style.display = 'none'
        }
        else {
            p.style.display = 'block'
        }
    }
})

function run_py() {
    hasAttention = false
    finalText = ''
    if (p.textContent !== '') {
        arg = String(p.textContent)
        fetch('/' + arg)
            .then(response => response.text())
            .then(result => {
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

function createInputMessage(text) {
    // message creation
    message = document.createElement('div')
    message.classList.add('message-bubble')
    message.classList.add('input')

    // p element
    p = document.createElement('p')
    p.textContent = text

    // attach to dom
    message.appendChild(p)
    convo.appendChild(message)
    scrollToBottom()
    isInitialPrompt = false
}

function createResponseMessage(text) {
    // message creation
    message = document.createElement('div')
    message.classList.add('message-bubble')
    message.classList.add('response')

    // p element
    p = document.createElement('p')
    p.textContent = text

    // attach to dom
    message.appendChild(p)
    convo.appendChild(message)
    scrollToBottom()
    isInitialPrompt = true
}

function scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight)
}

recognition.onend = () => {
    recognition.start()
}