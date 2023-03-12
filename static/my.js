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
let iconColor = '#c8c8c8'
let responseBubbleColor = '#6c757d'
let responseTextColor = '#ffffff'
let myBubbleColor = '#0d6efd'
let myTextColor = '#ffffff'
let bgColor = '#343a40'
let finalText = ''
let convo = document.getElementById('convo')
let settingsModal = document.getElementById('modal')
let notAllowed = ['Tab','Shift','Control','Alt','CapsLock','Insert','Home','PageUp','PageDown','ArrowUp',
'ArrowDown','ArrowLeft','ArrowRight','Meta','Escape','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11',
'F12','Delete','Backspace',' ', '\\']
let assistantName = 'Jarvis'
let sysMessage = [{"role": "system", "content": `You are ${assistantName}, a knowledgable AI assistant that answers questions precisely and to the best of your ability.`}]
let messages = []
let addressPref = ''
let codeCellNum = 0

// mic input
recognition.addEventListener('result', e => {
    if (settingsModal.style.display === "none") {
        const transcript = Array.from(e.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('')

        // only take input after name/nickname has been called
        if (transcript.includes(assistantName)) {
            hasAttention = true
            if (isInitialPrompt) {
                createResponseMessage(acknowledge())
                createInputMessage('')
            }

            // track final text
            if (e.results[0].isFinal) {
                finalText += transcript + ' '
            }

            // fill the message box with spoken text
            bubble.textContent = transcript.slice(transcript.lastIndexOf(assistantName) + assistantName.length + 1)
            scrollToBottom()
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
            scrollToBottom()

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
    }
})

// keyboard input
document.addEventListener('keydown', function(e) {
    if (settingsModal.style.display === "none") {
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
                scrollToBottom()
            }
            else if (e.key === ' ') {
                e.preventDefault()
                bubble.innerHTML += ' '
                scrollToBottom()
            }
            else if (e.key === 'Backspace') {
                bubble.textContent = bubble.textContent.substring(0, bubble.textContent.length-1)
            }

            if (bubble.textContent === '') {
                convo.removeChild(message)
                isInitialPrompt = true
            }
        }
    }
})

// text response from gpt-3.5-turbo
function get_response() {
    hasAttention = false
    finalText = ''
    if (bubble.textContent !== '' && !isInitialPrompt) {
        arg = String(bubble.textContent)
        pushMessage({'role': 'user', 'content': arg})

        fetch('/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(sysMessage.concat(messages))
        })
        .then(response => response.text())
        .then(result => {
            pushMessage({'role': 'assistant', 'content': result})
            responses = result.split('```')

            for (let i = 0; i < responses.length; i++) {
                if (i % 2 == 0) {
                    if (speakersAllowed) {get_speech(responses[i])}
                    createResponseMessage(responses[i])
                }
                else {
                    createCodeBlock(responses[i])
                }
            }
        })
        .catch(error => console.error(error))
    }
    else {
        convo.removeChild(message)
        createResponseMessage('Going idle.')
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
    bubble.classList.add('card', 'fs-3', 'p-3', 'rounded-4', 'text-wrap', 'myInput')
    bubble.textContent = text
    bubble.style.maxWidth = '70%'
    bubble.style.backgroundColor = myBubbleColor
    bubble.style.color = myTextColor

    // attach to dom
    message.appendChild(bubble)
    convo.appendChild(message)
    isInitialPrompt = false
}

// on screen response bubble
function createResponseMessage(text) {
    // message creation
    message = document.createElement('div')
    message.classList.add('d-flex', 'justify-content-start', 'mb-3')

    // p element
    bubble = document.createElement('pre')
    bubble.classList.add('card', 'fs-3', 'p-3', 'rounded-4', 'text-wrap', 'response')
    bubble.innerText = text.replace("<br>", "")
    bubble.style.maxWidth = '70%'
    bubble.style.backgroundColor = responseBubbleColor
    bubble.style.color = responseTextColor
    bubble.style.overflowWrap = 'break-word'

    // attach to dom
    message.appendChild(bubble)
    convo.appendChild(message)
    scrollToBottom()
    isInitialPrompt = true
}

function createCodeBlock(text) {
    // message creation
    message = document.createElement('div')
    message.classList.add('d-flex', 'justify-content-start', 'mb-3')

    // p element
    bubble = document.createElement('div')
    bubble.classList.add('card', 'fs-3', 'p-3', 'rounded-4', 'text-wrap', 'response')
    bubble.style.width = '70%'
    bubble.style.backgroundColor = responseBubbleColor
    bubble.style.color = responseTextColor
    bubble.innerHTML = `<pre><code id=codeCell${codeCellNum}> ${text} </code></pre>`

    // copy button
    copyBtn = document.createElement('button')
    copyBtn.classList.add('btn', 'btn-secondary', 'btn-block', 'rounded-pill')
    copyBtn.innerHTML = 'Copy <i class="bi bi-clipboard"></i>'
    copyBtn.addEventListener('click', (event) => {
        console.log(event.target.previousElementSibling.textContent)
        navigator.clipboard.writeText(event.target.previousElementSibling.textContent)
    })

    // attach to dom
    bubble.appendChild(copyBtn)
    message.appendChild(bubble)
    convo.appendChild(message)
    scrollToBottom()
    isInitialPrompt = true
    codeCellNum += 1
}

function acknowledge() {
    let acknowledgements = ['How can I help you, ', 'How may I assist you, ', 'Yes ', 'Hello, how can I help you ', 'What can I  do for you ', 'Yes ']
    let acknowledgementsNone = ["What's up?", "How can I help you?", "How may I assist you today?", "What can I help you with?", "What can I do for you?"]

    if (addressPref == '') {
        return acknowledgementsNone[Math.floor(Math.random() * acknowledgementsNone.length)]
    }
    else {
        return acknowledgements[Math.floor(Math.random() * acknowledgements.length)] + addressPref + '?'
    }
}

// adjust to bottom (most recent) of convo
function scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight)
}

// user changed settings
function updateSettings() {
    // gather info from modal
    // access
    micAllowed = document.getElementById('allowMic').checked
    speakersAllowed = document.getElementById('allowSpeakers').checked

    // preferences
    assistantName = document.getElementById('name').value
    sysMessage = [{"role": "system", "content": `You are ${assistantName}, a knowledgable AI assistant that answers questions precisely and to the best of your ability.`}]

    if (document.getElementById("ma'am").checked) {
        addressPref = "ma'am"
    }
    else if (document.getElementById("sir").checked) {
        addressPref = 'sir'
    }
    else {
        addressPref = ''
    }

    // colors
    responseBubbleColor = document.getElementById('responseBubble').value
    responseTextColor = document.getElementById('responseText').value
    myBubbleColor = document.getElementById('myBubble').value
    myTextColor = document.getElementById('myText').value
    bgColor = document.getElementById('bgColor').value
    iconColor = document.getElementById('settings-icon').style.color
    responseBubbles = document.getElementsByClassName('response')
    myBubbles = document.getElementsByClassName('myInput')

    // mic access
    if (micAllowed) {
        try {
            recognition.start()
        }
        catch (error) {
            console.error(error)
        }
    }
    else {
        recognition.stop()
    }

    // change colors
    // response messages
    Array.from(responseBubbles).forEach(bubble => {
        bubble.style.backgroundColor = responseBubbleColor
        bubble.style.color = responseTextColor
    })
    // our messages
    Array.from(myBubbles).forEach(bubble => {
        bubble.style.backgroundColor = myBubbleColor
        bubble.style.color = myTextColor
    })
    document.body.style.backgroundColor = bgColor
}

function revertDefault() {
    document.getElementById('responseBubble').value = '#6c757d'
    document.getElementById('responseText').value = '#ffffff'
    document.getElementById('myBubble').value = '#0d6efd'
    document.getElementById('myText').value = '#ffffff'
    document.getElementById('bgColor').value = '#343a40'
}

function pushMessage(message) {
    messages.push(message)
    while (messages.length >= 8) {
        messages.shift()
        messages.shift()
    }
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