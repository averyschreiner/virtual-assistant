import openai
from decouple import config

openai.api_key = config('KEY')

def text_response(input):
    try:
        # response = openai.Completion.create(
        #     model="text-davinci-003",
        #     prompt= str(input),
        #     temperature=0,
        #     max_tokens=100
        #     )
        # return response.choices[0].text 
        return input
    except Exception as e:
        return 'Error', str(e)
