import openai
from decouple import config

openai.api_key = config('KEY')

def text_response(input):
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=input,
            temperature=0.4)
        return response['choices'][0]['message']['content']
        # return str(input[len(input) - 1])
    except Exception as e:
        return 'Error', str(e)
