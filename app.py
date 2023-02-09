from flask import Flask, render_template
from gpt import get_response

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/<arg>', methods = ['POST', 'GET'])
def run_py(arg):
    return get_response(arg)

if __name__ == '__main__':
    app.run(debug=True)