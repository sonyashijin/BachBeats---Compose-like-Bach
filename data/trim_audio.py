from pydub import AudioSegment
import os

directory = '/Users/sonyashijin/Documents/GitHub/109/static/sounds'

for filename in os.listdir(directory):
    if filename.endswith('.mp3') or filename.endswith('.wav'):  
        path = os.path.join(directory, filename)

        trimmed_audio = audio[:600]  

        trimmed_path = os.path.join(directory, f'trimmed_{filename}')
        trimmed_audio.export(trimmed_path, format='mp3')  
