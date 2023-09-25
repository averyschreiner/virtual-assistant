from flask import Flask, render_template, request, Response, session
from google.cloud import translate_v2 as translate, texttospeech
from spotipy.oauth2 import SpotifyClientCredentials
from newspaper import Article
from decouple import config
import json, openai, re, spotipy, requests, googlemaps, firebase_admin, tiktoken
from firebase_admin import credentials, db

app = Flask(__name__)
app.secret_key = config('SPOTIFY_SECRET')
app.config['SERVER_NAME'] = 'localhost:5000'

cred = credentials.Certificate('virtual-assistant-378601-firebase-adminsdk-pmfkd-6b325051f9.json')
firebase = firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://virtual-assistant-378601-default-rtdb.firebaseio.com/'
})

openai.api_key = config('OPENAI_SECRET')
spotify_secret = config('SPOTIFY_SECRET')
spotify_client_id = '5dfb1e82a6ce457aab62e55f3f056792'
creds = SpotifyClientCredentials(client_id=spotify_client_id, client_secret=spotify_secret)
sp = spotipy.Spotify(client_credentials_manager=creds)
gmaps = googlemaps.Client(key=config('GOOGLE_MAPS_SECRET'))

langs = {'ar': ['ar-XA', 'ar-XA-Standard-C', 'ar-XA-Standard-D'],
         'bn': ['bn-IN', 'bn-IN-Standard-B', 'bn-IN-Standard-A'],
         'en': ['en-US', 'en-US-Studio-M', 'en-US-Studio-O'],
         'fr': ['fr-FR', 'fr-FR-Neural2-B', 'fr-FR-Neural2-C'],
         'de': ['de-DE', 'de-DE-Neural2-D', 'de-DE-Neural2-F'],
         'hi': ['hi-IN', 'hi-IN-Neural2-C', 'hi-IN-Neural2-A'],
         'id': ['id-ID', 'id-ID-Standard-C', 'id-ID-Standard-A'],
         'it': ['it-IT', 'it-IT-Neural2-C', 'it-IT-Neural2-A'],
         'ja': ['ja-JP', 'ja-JP-Neural2-C', 'ja-JP-Neural2-B'],
         'zh': ['cmn-CN', 'cmn-CN-Standard-C', 'cmn-CN-Standard-A'],
         'pt': ['pt-BR', 'pt-BR-Neural2-B', 'pt-BR-Neural2-C'],
         'pa': ['pa-IN', 'pa-IN-Standard-B', 'pa-IN-Standard-A'],
         'ru': ['ru-RU', 'ru-RU-Standard-D', 'ru-RU-Standard-A'],
         'es': ['es-US', 'es-US-Studio-B', 'es-US-Neural2-A'],
         'tr': ['tr-TR', 'tr-TR-Standard-E', 'tr-TR-Standard-A'],
         'vi': ['vi-VN', 'vi-VN-Standard-D', 'vi-VN-Standard-C']}

functions = [
    {
        "name": "get_location_weather",
        "description": "Get the current weather of a given location.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco"                    
                }
            },
            "required": ["location"]
        }
    },
    {
        "name": "get_local_weather",
        "description": "Get the local weather when a location is not specified.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
]

def get_location_weather(location):
    # get lat and lng of location
    geocode = gmaps.geocode(location)

    lat = geocode[0]['geometry']['location']['lat']
    lng = geocode[0]['geometry']['location']['lng']

    # get forecast for the lat and lng
    response = requests.get(f"https://api.weather.gov/points/{lat},{lng}").json()
    forecast = requests.get(response['properties']['forecast']).json()
    part1 = forecast['properties']['periods'][0]['name'].lower()
    details1 = forecast['properties']['periods'][0]['detailedForecast'].lower()
    part2 = forecast['properties']['periods'][1]['name'].lower()
    details2 = forecast['properties']['periods'][1]['detailedForecast'].lower()

    return f"{part1} is {details1} And for {part2}, {details2}"

def get_local_weather():
    if 'lat' in session and 'lng' in session:
        # get forecast for the current user's lat and lng
        response = requests.get(f"https://api.weather.gov/points/{session['lat']},{session['lng']}").json()
        forecast = requests.get(response['properties']['forecast']).json()
        part1 = forecast['properties']['periods'][0]['name'].lower()
        details1 = forecast['properties']['periods'][0]['detailedForecast'].lower()
        part2 = forecast['properties']['periods'][1]['name'].lower()
        details2 = forecast['properties']['periods'][1]['detailedForecast'].lower()

        return f"{part1} is {details1} And for {part2}, {details2}"
    else:
        return "To get local weather, you must give the webpage access to your location, or specificy a location."

function_map = {"get_location_weather": get_location_weather, "get_local_weather": get_local_weather}

@app.route('/')
def home():
    return render_template('index.html')

def check_tokens(messages):
    encoding = tiktoken.encoding_for_model("gpt-4-0613")
    max_tokens = 8192
    num_tokens = 0
    for message in messages:
        num_tokens += 4
        for k, v in message.items():
            num_tokens += len(encoding.encode(v))
            if k == "name":
                num_tokens -= 1
    num_tokens += 2

    # if we are over our token limit or the earliest message is from the assistant, pop and retry
    if num_tokens > max_tokens:
        messages.pop(1)
        check_tokens(messages)

    return messages

@app.route('/chat', methods=['POST'])
def chat():
    try:
        messages = json.loads(request.data.decode('utf-8'))
        messages = check_tokens(messages)
        response = openai.ChatCompletion.create(
            model="gpt-4-0613",
            messages=messages,
            functions=functions,
            temperature=0.4)
        response_message = response['choices'][0]['message']
        # model could call a function
        if response_message.get("function_call"):
            function_name = response_message['function_call']['name']
            function_to_call = function_map[function_name]
            function_args = json.loads(response_message['function_call']['arguments'])
            
            # upon response from a function, lets have the model create our user facing response
            function_response = function_to_call(**function_args)
            messages.append({'role': 'function', 'name': function_name, 'content': function_response})
            second_response = openai.ChatCompletion.create(
                model="gpt-4-0613",
                messages=messages,
                functions=functions,
                temperature=0.4)
            response_message = second_response['choices'][0]['message']
            gpt_text = response_message['content']
            gpt_text = re.sub("\n```|```\n", "```", gpt_text)
            messages.append({'role': 'assistant', 'content': gpt_text})
            return {'messages': messages}
        else:
            gpt_text = response_message['content']
            gpt_text = re.sub("\n```|```\n", "```", gpt_text)

            # if a preference or something else silly ask davinci
            if ('s an AI' in gpt_text):
                question = messages[-2]['content']
                try:
                    response = openai.Completion.create(
                        model="text-davinci-003",
                        prompt= question,
                        temperature=0.8,
                        max_tokens=2048)
                    response_text = response['choices'][0]['text']
                    messages.append({'role': 'assistant', 'content': response_text})
                    return {'messages': messages}
                except:
                    messages.append({'role': 'assistant', 'content': 'An error occured, please refresh the page.'})
                    return {'messages': messages}
            else:
                messages.append({'role': 'assistant', 'content': gpt_text})
                return {'messages': messages}
            
    except Exception as e:
        messages.append({'role': 'assistant', 'content': 'An error occured, please refresh the page.'})
        return {'messages': messages}

@app.route('/speak', methods=['POST'])
def speak():
    try:
        data = json.loads(request.data.decode('utf-8'))
        text = data['text']
        lang = data['lang']
        male = data['male']
        language_code = langs[lang][0]

        if male:
            name = langs[lang][1]
        else:
            name = langs[lang][2]

        client = texttospeech.TextToSpeechClient()
        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=name)
        audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        return Response(response.audio_content, mimetype='audio/mp3')
    except: 
        pass

@app.route('/article', methods=['POST'])
def article():
    try:
        data = json.loads(request.data.decode('utf-8'))
        url = data['url']
        article = Article(url)
        article.download()
        article.parse()
        authors = ', '.join(article.authors)

        return f"Title:{article.title}\n\nAuthor:{authors}\n\nDate:{article.publish_date}\n\n{article.text}"

    except:
        pass

@app.route('/translate', methods=['POST'])
def switchLang():
    try:
        data = json.loads(request.data.decode('utf-8'))
        lang = data['lang']
        text = data['text']
        client = translate.Client()
        result = client.translate(text, target_language=lang)

        return result['translatedText']

    except:
        pass

@app.route('/spotify_query', methods=['POST'])
def spotify_query():
    try:
        data = json.loads(request.data.decode('utf-8'))
        query = data['query']
        results = sp.search(q=query, type=['track'], limit=1)
        
        return str(results['tracks']['items'][0]['uri'])
    except:
        pass

@app.route('/weather', methods=['POST'])
def weather():
    try:
        data = json.loads(request.data.decode('utf-8'))
        need_cords = data['need_coords']
        lat = data['lat']
        lng = data['lng']

        if need_cords:
            city = data['city']
            geocode = gmaps.geocode(city)
            lat = geocode[0]['geometry']['location']['lat']
            lng = geocode[0]['geometry']['location']['lng']
            response = requests.get(f"https://api.weather.gov/points/{lat},{lng}").json()
            forecast = requests.get(response['properties']['forecast']).json()
            part1 = forecast['properties']['periods'][0]['name'].lower()
            details1 = forecast['properties']['periods'][0]['detailedForecast'].lower()
            part2 = forecast['properties']['periods'][1]['name'].lower()
            details2 = forecast['properties']['periods'][1]['detailedForecast'].lower()
        else:
            response = requests.get(f"https://api.weather.gov/points/{lat},{lng}").json()
            forecast = requests.get(response['properties']['forecast']).json()
            part1 = forecast['properties']['periods'][0]['name'].lower()
            details1 = forecast['properties']['periods'][0]['detailedForecast'].lower()
            part2 = forecast['properties']['periods'][1]['name'].lower()
            details2 = forecast['properties']['periods'][1]['detailedForecast'].lower()

        return f"{part1} is {details1} And for {part2}, {details2}"

    except:
        pass

@app.route('/get_user_info', methods=['POST'])
def get_user_info():
    try:
        data = json.loads(request.data.decode('utf-8'))
        id = data['id']
        user_ref = db.reference(f'users/{id}')
        user_data = user_ref.get()

        return user_data
    except:
        pass

@app.route('/get_convo', methods=['POST'])
def get_convo():
    try:
        data = json.loads(request.data.decode('utf-8'))
        id = data['id']
        chatNum = data['chatNum']
        chat_ref = db.reference(f'users/{id}/chats/{chatNum}/messages')
        chat_data = chat_ref.get()
        return chat_data
    except:
        pass

@app.route('/set_messages', methods=['POST'])
def set_messages():
    try:
        data = json.loads(request.data.decode('utf-8'))
        id = data['id']
        chatNum = data['chatNum']
        messages = data['messages']
        message_ref = db.reference(f'users/{id}/chats/{chatNum}/messages')
        db_dict = {index: messages[index] for index in range(len(messages))}
        message_ref.set(db_dict)

        title_ref = db.reference(f'users/{id}/chats/{chatNum}/title')
        if title_ref.get() == None:
            return {'hasTitle': False, 'id': id, 'chatNum': chatNum}
        else:
            return {'hasTitle': True}
    except:
        pass

@app.route('/set_title', methods=['POST'])
def set_title():
    try:
        data = json.loads(request.data.decode('utf-8'))
        id = data['id']
        chatNum = data['chatNum']
        title = data['title']
        title_ref = db.reference(f'users/{id}/chats/{chatNum}')
        title_ref.update({
            'title': title
        })
        return 'All Good'
    except:
        return 'An Error Occurred'

@app.route('/create_title', methods=['POST'])
def create_title():
    try:
        data = json.loads(request.data.decode('utf-8'))
        id = data['id']
        chatNum = data['chatNum']
        message_ref = db.reference(f'users/{id}/chats/{chatNum}/messages')
        messages = message_ref.get()
        for m in messages:
            if m['role'] == 'user':
                message = m
                break
        messages = [{'role': 'user', 'content': 'Create a short title, 2 or 3 words, for a conversation that starts with: ' + message['content']}]
        response = openai.ChatCompletion.create(
            model="gpt-4-0613",
            messages=messages,
            temperature=0.4)
        gpt_text = response['choices'][0]['message']['content'].strip('"')
        title_ref = db.reference(f'users/{id}/chats/{chatNum}')
        title_ref.update({
            'title': gpt_text
        })

        return {'title': gpt_text, 'id': id, 'chatNum': chatNum}
    except:
        return {'title': 'Error creating title', 'id': id, 'chatNum': -1}
    
@app.route('/delete_all_chats', methods=['POST'])
def delete_all_chats():
    try:
        data = json.loads(request.data.decode('utf-8'))
        id = data['id']
        delete_ref = db.reference(f'users/{id}/chats')
        delete_ref.delete()

        return 'Delete Sucessful'
    except:
        return 'An Error Occurred'
    
@app.route('/delete_chat', methods=['POST'])
def delete_chat():
    try:
        data = json.loads(request.data.decode('utf-8'))
        id = data['id']
        chatNum = data['chatNum']
        chat_ref = db.reference(f'users/{id}/chats/{chatNum}')
        chat_ref.delete()

        return 'Delete Sucessful'
    except:
        return 'An Error Occurred'
    
@app.route('/save_settings', methods=['POST'])
def save_settings():
    try:
        data = json.loads(request.data.decode('utf-8'))
        id = data['id']
        settings_ref = db.reference(f'users/{id}/settings')
        settings_ref.update({
            'mic': data['mic'],
            'sound': data['sound'],
            'spotify_desktop': data['spotify_desktop'],
            'assistant_name': data['assistant_name'],
            'assistant_personality': data['assistant_personality'],
            'lang': data['lang'],
            'voice_gender_male': data['voice_gender_male'],
            'manners': data['manners'],
            'rm_color': data['rm_color'],
            'rt_color': data['rt_color'],
            'mm_color': data['mm_color'],
            'mt_color': data['mt_color'],
            'bg_color': data['bg_color']
        })

        return 'Save Sucessful'
    except:
        return 'An Error Occurred'
    
@app.route('/set_location', methods=['POST'])
def set_location():
    try:
        data = json.loads(request.data.decode('utf-8'))
        session['lat'] = data['lat']
        session['lng'] = data['lng']

        return 'All good'
    except:
        return 'An Error Occured'

if __name__ == '__main__':
    app.run(debug=True)