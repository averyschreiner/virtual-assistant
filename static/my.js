window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

let isInitialPrompt = true
const recognition = new SpeechRecognition()
recognition.interimResults = true
recognition.lang = 'en-US'

// create initial elements
let convo = document.querySelector('.convo-wrapper')

recognition.addEventListener('result', e => {
    const transcript = Array.from(e.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('')
 
        // only take input after name has been called
        if (transcript.includes('Hey Joe')) {
            if (isInitialPrompt) {
                createInputMessage(transcript.slice(transcript.lastIndexOf('Hey Joe') + 'Hey Joe'.length + 1))
                isInitialPrompt = false
            }
            else {
                p.textContent = transcript.slice(transcript.lastIndexOf('Hey Joe') + 'Hey Joe'.length + 1)
            }
            
            if (e.results[0].isFinal) {
                run_py()
            }
        }
})

recognition.addEventListener('end', recognition.start)

// document.addEventListener('keydown', function(e) {
//     console.log('key: ' + e.key)
//     if (e.key == 'Enter') {
//         e.preventDefault()
//         console.log('before run py')
//         run_py()
//         console.log('after run py')
//     }
// })

function run_py() {
    if (arg = String(p.textContent)) {
        fetch('/' + arg)
            .then(response => response.text())
            .then(result => {
                // add response to screen
                createResponseMessage(result)
                isInitialPrompt = true
            })
            .catch(error => {
                console.error(error)
            })
    }
    else {
        setTimeout(() => {
            run_py()
        }, 500)
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
}

function scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight)
  }
recognition.start()
