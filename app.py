from flask import Flask, render_template
from gpt import text_response
from speech import gen_speech

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/<arg>', methods = ['POST', 'GET'])
def run_py(arg):
    return text_response(arg) 

@app.route('/speak/<text>')
def speak(text):
    gen_speech(text)

if __name__ == '__main__':
    app.run(debug=True)