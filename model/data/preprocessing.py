import os
import random
import pandas as pd
import music21

# Paths
extracted_folder_path = '/Users/sonyashijin/three-js-games/piano_mesh/src/model/data/extracted_data'
csv_file_path = os.path.join(extracted_folder_path, 'output.csv')

# Extract pitches and intervals from a MIDI file
def extract_pitch_and_intervals(midi_file):
    midi_data = music21.converter.parse(midi_file)
    notes = [note for note in midi_data.flat.notes if isinstance(note, music21.note.Note)]
    
    pitches, intervals = [], []
    for i in range(1, len(notes)):
        pitch = notes[i].pitch.midi
        interval = pitch - notes[i-1].pitch.midi
        pitches.append(pitch)
        intervals.append(interval)

    return pitches, intervals

# Process MIDI files and collect data
def process_midi_files(midi_files, label):
    data = []
    for midi_file in midi_files:
        pitches, intervals = extract_pitch_and_intervals(midi_file)
        data.extend([(pitch, interval, label) for pitch, interval in zip(pitches, intervals)])
    return data

# Getting MIDI file paths
extracted_files = os.listdir(extracted_folder_path)
bach_path = '/Users/sonyashijin/three-js-games/piano_mesh/src/model/data/extracted_data/bach'
bach_midi_files = [os.path.join(bach_path, f) for f in os.listdir(bach_path) if f.endswith(('.mid', '.midi'))]
num_bach_files = len(bach_midi_files)

non_bach_midi_files = []
for composer in extracted_files:
    if composer.lower() != 'bach':
        composer_path = os.path.join(extracted_folder_path, composer)
        non_bach_midi_files.extend([os.path.join(composer_path, f) for f in os.listdir(composer_path) if f.endswith(('.mid', '.midi'))])

selected_non_bach_files = random.sample(non_bach_midi_files, num_bach_files)

# Processing MIDI files
data = process_midi_files(bach_midi_files, 1)  # Bach files
data.extend(process_midi_files(selected_non_bach_files, 0))  # Non-Bach files

# Creating the DataFrame
df = pd.DataFrame(data, columns=['pitch', 'interval', 'label'])

# Define window size for rolling statistics
window_size = 5

# Functions to calculate rolling statistics
def rolling_avg(data, window_size):
    return data.rolling(window=window_size, min_periods=1).mean()

def rolling_std(data, window_size):
    return data.rolling(window=window_size, min_periods=1).std()

# Calculate rolling statistics for pitch and interval
df['rolling_avg_pitch'] = rolling_avg(df['pitch'], window_size)
df['rolling_std_pitch'] = rolling_std(df['pitch'], window_size)
df['rolling_avg_interval'] = rolling_avg(df['interval'], window_size)
df['rolling_std_interval'] = rolling_std(df['interval'], window_size)

# Fill NaN values in rolling std columns with 0 (occurs for the first few rows)
df['rolling_std_pitch'].fillna(0, inplace=True)
df['rolling_std_interval'].fillna(0, inplace=True)

# Save the DataFrame as a CSV file with rolling statistics
df.to_csv(csv_file_path, index=False)

print("Dataset with rolling statistics saved.")
