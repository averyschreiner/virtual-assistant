let lastSpoke
let submissionTimeout
let isInitialPrompt = true
let hasAttention = false
let micAllowed = false
let speakersAllowed = false
let spotifyDesktop = false
let iconColor = '#c8c8c8'
let responseBubbleColor = '#6c757d'
let responseTextColor = '#ffffff'
let myBubbleColor = '#0d6efd'
let myTextColor = '#ffffff'
let bgColor = '#343a40'
let finalText = ''
let convo = document.getElementById('convo')
let settingsModal = document.getElementById('settings')
let notAllowed = ['Tab','Shift','Control','Alt','CapsLock','Insert','Home','PageUp','PageDown','ArrowUp',
'ArrowDown','ArrowLeft','ArrowRight','Meta','Escape','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11',
'F12','Delete','Backspace',' ', '\\']
let assistantName = 'Jarvis'
let roles = {"general": "answers questions precisely.", 
'coder': 'specializes in coding. When asked a coding question, provide pseudo code of the approach to the problem, then the actual code itself, then an explaination of the code.',
'poet': 'responds in an elegant and poetic way, and often rhymes responses.',
'brief': "responds in as few words as possible. Don't leave out crucial information, and don't give lots of details in responses.",
'elaborator': "responds in as much detail as possible. Don't leave any information out whatsoever."}
let sysMessage = [{"role": "system", "content": `You are ${assistantName}, a knowledgable AI assistant that ${roles['general']}`}]
let messages = []
let addressPref = ''
let audio = document.getElementById('sound')
let male = true
let articleText = ''
let urls = []
let lang = 'en'
let textToBeSpoken = ''
let id = -1
let chatNum = -1

// recog
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
const recognition = new SpeechRecognition()
recognition.interimResults = true
recognition.lang = lang

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
                acknowledge()
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
                get_response()
            }, 2000)
        }
    }
})

// handles all responses
function get_response() {
    hasAttention = false
    finalText = ''
    arg = String(bubble.textContent)
    let regex = /((http|https):\/\/[^\s]+)/g
    urls = arg.match(regex)

    // spotify command
    if (arg.toLowerCase().includes('on spotify')) {
        spotifyResponse()
        pushMessage({'role': 'user', 'content': arg})
        arg = arg.toLowerCase().replace('on spotify', '')
        arg = arg.slice(arg.lastIndexOf('play') + 4)
        spotify(arg)
    }
    // shut down
    // else if (arg.toLowerCase() == 'shut down')
    // good morning
    else if (arg.toLowerCase().includes('good morning') || arg.toLowerCase() == 'gm') {
        if (addressPref == '') {
            createResponseMessage(`Good morning!`)
        }
        else {
            createResponseMessage(`Good morning ${addressPref}!`)
        }
        need_coords = false
        city = ''
        fetch('/weather', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({'city': city, 'lat': lat, 'lng': lng, 'need_coords': need_coords})
        })
        .then(response => response.text())
        .then(text => {
            if (need_coords) {
                text = 'The weather in ' + city + text
            }
            else {
                text = 'The weather for ' + text
            }
            if (speakersAllowed) {
                get_speech(text)
            }
            pushMessage({'role': 'user', 'content': arg})
            pushMessage({'role': 'assistant', 'content': text})
            createResponseMessage(text)
            createResponseMessage('Let me know if there is anything I can help you with! <3')
        })
    }
    // weather command
    else if (arg.includes('weather')) {
        weatherResponse()
        arg = arg.trim()
        let words = arg.split(' ')
        let city = ''
        let need_coords = true
        for (let word of words) {
            if (word.charAt(0) == word.charAt(0).toUpperCase()) {
                city += word + ' '
            }
        }
        // get weather for current location
        if (city == '') {
            need_coords = false
        }
        else {
            need_coords = true
        }

        fetch('/weather', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({'city': city, 'lat': lat, 'lng': lng, 'need_coords': need_coords})
        })
        .then(response => response.text())
        .then(text => {
            if (need_coords) {
                text = 'The weather in ' + city + text
            }
            else {
                text = 'The weather for ' + text
            }
            if (speakersAllowed) {
                get_speech(text)
            }
            pushMessage({'role': 'user', 'content': arg})
            pushMessage({'role': 'assistant', 'content': text})
            createResponseMessage(text)
        })
    }
    // summarize article given link
    else if (urls != null) {
        summaryResponse()
        fetch('/article', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({'url': urls[0]})
        })
        .then(response => response.text())
        .then(text => {
            arg = arg.replace(urls[0], '\n\n---\n\n' + text + '\n\n---\n\n')
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
                    let chunkOText = responses[i]
                    if (i % 2 == 0) {
                        if (speakersAllowed) {
                            textToBeSpoken += chunkOText
                        }
                        createResponseMessage(chunkOText)
                    }
                    else {
                        createCodeBlock(chunkOText)
                    }
                }
                if (speakersAllowed) {
                    get_speech(textToBeSpoken)
                }
            })
            .catch(error => console.error(error))
            })
        .catch(error => {
            console.error(error)
        })
    }
    // normal gpt prompt
    else if (arg !== '' && !isInitialPrompt) {
        pushMessage({'role': 'user', 'content': arg})
        afterPrompt()

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
                let chunkOText = responses[i].trim()
                if (i % 2 == 0) {
                    if (speakersAllowed) {
                        textToBeSpoken += chunkOText
                    }
                    if (chunkOText != '') {
                        createResponseMessage(chunkOText)
                    }
                }
                else {
                    createCodeBlock(chunkOText)
                }
            }
            if (speakersAllowed) {
                get_speech(textToBeSpoken)
            }
            set_messages()
        })
        .catch(error => console.error(error))
    }
    // mic input expired with no spoken content
    else {
        convo.removeChild(message)
        if (lang == 'en') {
            createResponseMessage('Going idle.')
            pushMessage({'role': 'assistant', 'content': 'Going idle'})
        }
        isInitialPrompt = true
    }
}

// update message record
function set_messages() {
    if (id != -1) {
        fetch('/set_messages', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({'id': id, 'chatNum': chatNum, 'messages': sysMessage.concat(messages)})
        })
        .then(response => response.json())
        .then(data => {
            if (!data.hasTitle) {
                fetch('/create_title', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({'id': id, 'chatNum': chatNum})
                })
                .then(response => response.json())
                .then(data => {
                    if (id == data.id) {
                        convobox = document.createElement('div')
                        convobox.classList.add('hstack', 'gap-1', 'overflow-hidden')
                        convobox.style.color = '#c8c8c8"'
                        convobox.innerHTML = `
                            <button class="btn btn-outline-secondary rounded text-center overflow-hidden text-nowrap flex-grow-1" onclick=loadConversation(${chatNum}) data-bs-dismiss=offcanvas>${data.title}</button>
                            <button type="button" class="btn btn-outline-danger" onclick=delete_chat(${data.chatNum});remove_convobox(this);>
                                <i class="bi bi-trash3" style="color: #b50000"></i>
                            </button>
                        `
                        menu.appendChild(convobox)
                    }
                })

            }
        })
        
    }
}

// spoken response
function get_speech(result) {
    let pack = {'text': result, 'lang': lang, 'male': male}
    fetch('/speak', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(pack)
    })
    .then(response => response.blob())
    .then(blob => {
        let audioURL = URL.createObjectURL(blob)
        let audio = new Audio(audioURL)
        audio.play()
        textToBeSpoken = ''
    })
    .catch(error => {
        console.error(error)
    })
}
function translateSettings(lang) {
    labels = document.getElementsByClassName('label')
    for (let i = 0; i < labels.length; i++) {
        fetch('/translate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({'lang': lang, 'text': labels[i].textContent})
        })
        .then(response => response.text())
        .then(text => {
            labels[i].textContent = text
        })
        .catch(error => {
            console.error(error)
        })
    }
    // translate send message placeholder
    fetch('/translate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({'lang': lang, 'text': 'Send a message...'})
    })
    .then(response => response.text())
    .then(text => {
        textarea.setAttribute('placeholder', text)
    })
    .catch(error => {
        console.error(error)
    })
}


function spotify(query) {
    fetch('/spotify_query', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({'query': query})
    })
    .then(response => response.text())
    .then(text => {
        if (spotifyDesktop) {
            window.location.href = text
        }
        else {
            let trackURI = text.split(":")[2]
            let url = "https://open.spotify.com/track/" + trackURI
            window.open(url, "_blank")
        }
    })
}

// on screen text bubble
function createInputMessage(text) {
    createMessage('justify-content-end')

    // p element
    bubble = document.createElement('pre')
    bubble.classList.add('card', 'fs-4', 'p-3', 'rounded-4', 'text-wrap', 'myInput')
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
    createMessage('justify-content-start')

    // p element
    bubble = document.createElement('pre')
    bubble.classList.add('card', 'fs-4', 'p-3', 'rounded-4', 'text-wrap', 'response')
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

function createCodeBlock(text) {
    createMessage('justify-content-start')

    // p element
    bubble = document.createElement('div')
    bubble.classList.add('card', 'fs-4', 'p-3', 'rounded-4', 'text-wrap', 'response')
    bubble.style.width = '70%'
    bubble.style.backgroundColor = responseBubbleColor
    bubble.style.color = responseTextColor
    codetag = document.createElement('code')
    codetag.textContent = text

    // copy button
    copyBtn = document.createElement('button')
    copyBtn.classList.add('btn', 'btn-secondary', 'btn-block', 'rounded-pill')
    copyBtn.innerHTML = 'Copy <i class="bi bi-clipboard"></i>'
    copyBtn.addEventListener('click', (event) => {
        navigator.clipboard.writeText(event.target.parentNode.textContent.slice(0,-5))
    })
    
    // attach to dom
    pre = document.createElement('pre')
    pre.appendChild(codetag)
    bubble.appendChild(pre)
    bubble.appendChild(copyBtn)
    message.appendChild(bubble)
    convo.appendChild(message)
    scrollToBottom()
    isInitialPrompt = true
}

function createMessage(justify) {
    // message creation
    message = document.createElement('div')
    message.classList.add('d-flex', justify, 'mb-3')
}

function acknowledge() {
    if (lang != 'en') {return} // lang support comming soon

    let acknowledgements = ['How can I help you', 'How may I assist you', 'Hello, how can I help you', 'What can I do for you', "What can I help you with"]
    let picked = ''
    if (addressPref == '') {
        picked = acknowledgements[Math.floor(Math.random() * acknowledgements.length)] + '?'
    }
    else {
        picked = acknowledgements[Math.floor(Math.random() * acknowledgements.length)] + ' ' + addressPref + '?'
    }
    pushMessage({'role': 'assistant', 'content': picked})
    createResponseMessage(picked)
}

function afterPrompt() {
    if (lang != 'en') {return} // lang support comming soon

    let afterPrompts = ['Let me look into it', 'Let me check for you', 'Looking into it']
    let picked = ''
    if (addressPref == '') {
        picked = afterPrompts[Math.floor(Math.random() * afterPrompts.length)] + '.'
    }
    else {
        picked = afterPrompts[Math.floor(Math.random() * afterPrompts.length)] + ' ' + addressPref + '.'
    }
    pushMessage({'role': 'assistant', 'content': picked})
    createResponseMessage(picked)
}

function spotifyResponse() {
    if (lang != 'en') {return} // lang support comming soon

    let picked = ''
    let spotifyResponses = ["Good pick! I'm on it.", "You have greate taste!", "Solid choice! Playing it now.", "One of my favorites!"]
    picked = spotifyResponses[Math.floor(Math.random() * spotifyResponses.length)]
    pushMessage({'role': 'assistant', 'content': picked})
    createResponseMessage(picked)
}

function summaryResponse() {
    if (lang != 'en') {return} // lang support comming soon

    let picked = ''
    let summaryResponses = ["Reading up on it now.", "Let me skim this really quick.", "Let me take a look.", "Let's see what we have here."]
    picked = summaryResponses[Math.floor(Math.random() * summaryResponses.length)]
    pushMessage({'role': 'assistant', 'content': picked})
    createResponseMessage(picked)
}

function weatherResponse() {
    if (lang != 'en') {return} // lang support comming soon

    let picked = ''
    let weatherResponses = ['Let me check the forecast briefly.', "Let me read the forecast for the next few hours."]
    picked = weatherResponses[Math.floor(Math.random() * weatherResponses.length)]
    pushMessage({'role': 'assistant', 'content': picked})
    createResponseMessage(picked)
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
    spotifyDesktop = document.getElementById('spotifyDesktop').checked

    // preferences
    assistantName = document.getElementById('name').value
    document.title = assistantName
    personality = document.getElementById('role').value
    sysMessage = [{"role": "system", "content": `You are ${assistantName}, a knowledgable AI assistant that ${roles[personality]}`}]
    lang = document.getElementById('language').value
    if (lang != recognition.lang) {
        translateSettings(lang)
        recognition.lang = lang
    }
    male = document.getElementById('gender').value == 'male'
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
    while (messages.length >= 30) {
        messages.shift()
        messages.shift()
    }
}

document.addEventListener('DOMContentLoaded', function() {
    navigator.geolocation.getCurrentPosition(geoLocation);
    newConvo()
})

function geoLocation(position) {
    lat = position.coords.latitude
    lng = position.coords.longitude
}
menu
// chatgpt magic
function decodeJwtResponse(jwt) {
    var base64Url = jwt.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
}).join(''));
    return JSON.parse(jsonPayload);
}

signin = document.getElementById('sign-in')
menu = document.getElementById('menu')
footer_buttons = document.getElementById('footer-buttons')
function handleCredentialResponse(response) {
    let responsePayload = decodeJwtResponse(response.credential);
    id = responsePayload.sub
    signin.innerHTML = responsePayload.name 
    footer_buttons.innerHTML += "<button type='button' class='btn btn-lg btn-outline-secondary' onclick=signOut()><i class='bi bi-box-arrow-right'></i></button>"
    fetch('/get_user_info', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({'id': id})
    })
    .then(response => response.json())
    .then(data => {
        // load chats
        let chats = data.chats
        for (let chat in chats) {
            convobox = document.createElement('div')
            convobox.classList.add('hstack', 'gap-1', 'overflow-hidden')
            convobox.style.color = '#c8c8c8"'
            convobox.innerHTML = `
                <button class="btn btn-outline-secondary rounded text-center overflow-hidden text-nowrap flex-grow-1" onclick=loadConversation(${chat}) data-bs-dismiss=offcanvas>${chats[chat].title}</button>
                <button type="button" class="btn btn-outline-danger" onclick=delete_chat(${chat});remove_convobox(this);>
                    <i class="bi bi-trash3" style="color: #b50000"></i>
                </button>
            `
            menu.appendChild(convobox)
        }
    })
}

function loadConversation(convoID) {
    // clear main conversations
    chatNum = convoID
    convo.innerHTML = ''
    messages = []
    fetch('/get_convo', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({'id': id, 'chatNum': convoID})
    })
    .then(response => response.json())
    .then(data => {
        for (let i of data) {
            if (i != null) {
                if (i.role == 'user') {
                    pushMessage({'role': 'user', 'content': i.content})
                    createInputMessage(i.content)
                }
                else if (i.role == 'assistant') {
                    pushMessage({'role': 'assistant', 'content': i.content})
                    createResponseMessage(i.content)
                }
            }
        }
    })
}

function delete_all_chats() {
    if (id != -1) {
        menu.innerHTML = ''
        fetch('/delete_all_chats', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({'id': id})
        })
        .then(response => response.text())
        .then(text => {
            alert(text)
        })
    }
}

function delete_chat(chatNumb) {
    if (id != -1) {
        if (chatNumb == chatNum) {
            newConvo()
        }
        fetch('/delete_chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({'id': id, 'chatNum': chatNumb})
        })
    }
}

function remove_convobox(button) {
    button.parentNode.remove()
}

function newConvo() {
    chatNum = Math.floor(Date.now() / 1000)
    convo.innerHTML = ''
    messages = []
}

// constant listening
recognition.onend = () => {
    if (micAllowed) {
        recognition.start()
    }
}

let textarea = document.getElementById('textarea')
textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (textarea.value != '') {
            createInputMessage(textarea.value)
            lastSpoke = Date.now()
            get_response()
        }
        textarea.value = ''
    }
});

let submitButton = document.getElementById('submitButton') 
submitButton.addEventListener('click', function() {
    if (textarea.value != '') {
        createInputMessage(textarea.value)
        lastSpoke = Date.now()
        get_response()
    }
    textarea.value = ''
})

function signOut() {
    // clear / reset everything and reload
    convo.innerHTML = ''
    menu.innerHTML = ''
    signin.innerHTML = `
    <div id="g_id_onload"
        data-client_id="843972136115-iljidrka8an7r95tdhceuf0ket3f51ou"
        data-context="signin"
        data-ux_mode="popup"
        data-callback="handleCredentialResponse"
        data-nonce=""
        data-auto_select="true"
        data-itp_support="true">
    </div>
    <div class="g_id_signin"
        data-type="standard"
        data-shape="rectangular"
        data-theme="outline"
        data-text="signin_with"
        data-size="large"
        data-logo_alignment="left">
    </div>
    `
    location.reload()
}