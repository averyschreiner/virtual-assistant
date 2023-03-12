from flask import Flask, render_template, request
from gpt import text_response
from speech import gen_speech
import json

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    messages_str = request.data.decode('utf-8')
    messages = json.loads(messages_str)
    return (text_response(messages))

@app.route('/speak/<text>')
def speak(text):
    gen_speech(text)

if __name__ == '__main__':
    app.run(debug=True)