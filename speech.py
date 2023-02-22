# import os
# import numpy
# from scipy.io import wavfile
# from tortoise.api import TextToSpeech
# from tortoise.utils.audio import load_audio
# from pydub import AudioSegment
# from pydub.playback import play

from google.cloud import texttospeech

def gen_speech(text):

    # dir_path = 'tortoise/voices/joe'
    # file_names = os.listdir(dir_path)
    # file_paths = [os.path.join(dir_path, file_name) for file_name in file_names]
    # reference_clips = [load_audio(p, 22050) for p in file_paths]
    # tts = TextToSpeech()
    # tensor_audio = tts.tts_with_preset(text, voice_samples=reference_clips, preset='standard')
    # np_audio = tensor_audio.numpy()
    # wavfile.write('static/spoken_result.wav', 22050, np_audio)
    
    # return 'done producing speech'
    



    # Instantiates a client
    client = texttospeech.TextToSpeechClient()

    # Set the text input to be synthesized
    synthesis_input = texttospeech.SynthesisInput(text=text)

    # Build the voice request, select the language code ("en-US") and the ssml
    # voice gender ("neutral")
    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US", ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
    )

    # Select the type of audio file you want returned
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    # Perform the text-to-speech request on the text input with the selected
    # voice parameters and audio file type
    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    # The response's audio_content is binary.
    with open("static/output.mp3", "wb") as out:
        # Write the response to the output file.
        out.write(response.audio_content)