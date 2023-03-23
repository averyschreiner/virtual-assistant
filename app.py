from flask import Flask, render_template, request, send_file
import json
from google.cloud import texttospeech
import openai
from decouple import config
import re

app = Flask(__name__)
openai.api_key = config('KEY')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    messages_str = request.data.decode('utf-8')
    messages = json.loads(messages_str)

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.4)
        gpt_text = response['choices'][0]['message']['content']

        # if a preference or something else silly ask davinci
        if ('s an AI' in gpt_text):
            question = messages[-1]['content']
            try:
                response = openai.Completion.create(
                    model="text-davinci-003",
                    prompt= question,
                    temperature=0.8,
                    max_tokens=2048)
            
                return response['choices'][0]['text']
            
            except Exception as e:
                return 'Error', str(e)
            
        else:
            return re.sub("\n```|```\n", "```", gpt_text)
        
    except Exception as e:
        return 'Error', str(e)

@app.route('/speak/<text>')
def speak(text):
    client = texttospeech.TextToSpeechClient()
    synthesis_input = texttospeech.SynthesisInput(text=text)

    voice = texttospeech.VoiceSelectionParams(
        language_code='en-US',
        name='en-US-Studio-M'
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config
    )

    with open('output.mp3', 'wb') as out:
        out.write(response.audio_content)

    return send_file('output.mp3', as_attachment=True) 

if __name__ == '__main__':
    app.run(debug=True)