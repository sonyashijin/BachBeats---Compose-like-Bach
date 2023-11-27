from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from thompson_sampling import DirichletMultinomialThompsonSampling
from logistic_regression import LogisticRegression

app = Flask(__name__)
CORS(app)

user_note_history = []
successful_notes_sequence = []
rolling_stats_history = []
ROLLING_STATS_MAX_LEN = 10


last_score = None

# Load your data
df = pd.read_csv('/Users/sonyashijin/three-js-games/piano_mesh/src/model/data/extracted_data/output.csv')

# Split the data into features and target
X = df[['pitch', 'interval', 'rolling_avg_pitch', 'rolling_std_pitch', 'rolling_avg_interval', 'rolling_std_interval']]
y = df['label']

# Train your model
model = LogisticRegression()
model.fit(X, y)

ts = DirichletMultinomialThompsonSampling(num_arms=61)

def calculate_reward(initial_score, updated_score, max_change=1, weight_factor=1):
    # Calculate the change in score
    score_change = updated_score - initial_score

    # Normalize the change
    normalized_change = score_change / max_change

    # Apply the weighting factor
    weighted_reward = normalized_change * weight_factor

    return weighted_reward

# Function to calculate rolling statistics
def calculate_rolling_statistics(notes, window_size=10):
    # Check if there are enough notes to calculate rolling statistics
    if len(notes) == 0:
        return 0,0,0,0
    if len(notes) >= window_size:
        windowed_notes = notes[-window_size:]
    else:
        windowed_notes = notes

    # Calculate mean and standard deviation for pitch
    rolling_avg_pitch = np.mean(windowed_notes)
    rolling_std_pitch = np.std(windowed_notes)

    # Calculate differences between consecutive notes for interval calculation
    diffs = np.diff(windowed_notes)

    # Calculate mean and standard deviation for interval
    mean_interval = np.mean(diffs) if len(diffs) > 0 else 0
    std_interval = np.std(diffs) if len(diffs) > 0 else 0
    rolling_stats_history.append((rolling_avg_pitch, rolling_std_pitch, mean_interval, std_interval))

    return rolling_avg_pitch, rolling_std_pitch, mean_interval, std_interval

@app.route('/user_history', methods=['GET'])
def user_history():
    return jsonify({'user_note_history': user_note_history})

@app.route('/view_distribution', methods=['GET'])
def view_distribution():
    # Convert numpy array to list for JSON serialization
    distribution = ts.alpha.tolist()
    return jsonify({'distribution': distribution})

@app.route('/predict', methods=['POST'])
def predict_and_update():
    global last_score
    update_message = "Keep going to update distribution!"
    data = request.json
    current_note = data['current_note']
    user_note_history.append(current_note)
    previous_notes = user_note_history[:-1]
    
    # calculate rolling stats
    rolling_stats = calculate_rolling_statistics(user_note_history)
    rolling_stats_list = list(rolling_stats)
    
    # get features
    if previous_notes:
        interval = current_note - previous_notes[-1]
    else:
        interval = 0

    input_features = [current_note, interval] + rolling_stats_list

    prediction = model.predict_proba([input_features])[0]

    # update the distribution
    if last_score is not None:
        reward = calculate_reward(last_score, prediction)

        if reward > 0:
            ts.update(current_note, reward)
            update_message = f"+{reward:.4f} reward to note {current_note}"
            successful_notes_sequence.append(current_note)
        else:
            # Corrected condition for applying full negative reward
            if ts.alpha[current_note] - abs(reward) >= 1.0:
                ts.update(current_note, reward)
                update_message = f"{reward:.4f} reward to note {current_note}"
            else:
                # Calculate the maximum decrement that keeps alpha above 1
                max_neg_reward = 1 - ts.alpha[current_note]
                # Apply the maximum decrement if it's greater than zero
                if max_neg_reward > 0:
                    ts.update(current_note, -max_neg_reward)
                    update_message = f"-{max_neg_reward:.4f} max decrement to note {current_note} (to keep alpha above 1)"
                else:
                    update_message = f"Distribution unchanged to keep alpha > 1. Attempted decrement: {reward:.4f}."


        # Debug prints
        print(f"Alpha after update: {ts.alpha[current_note]}, Update Message: {update_message}")

    # update last score
    last_score = prediction

    return jsonify({'bach_likeness_score': prediction, 'update_message': update_message})

@app.route('/get_success_sequence', methods=['GET'])
def get_success_sequence():
    return jsonify({'success_sequence': successful_notes_sequence})

@app.route('/reset_sequence', methods=['POST'])
def reset_sequence():
    global user_note_history
    user_note_history = []  # Reset the user note history
    successful_notes_sequence.clear()
    return jsonify({'status': 'sequence reset'})

@app.route('/suggest_note', methods=['GET'])
def suggest_note():
    suggested_note = ts.select_arm()
    return jsonify({'suggested_note': int(suggested_note)})

@app.route('/get_rolling_statistics', methods=['GET'])
def get_rolling_statistics():
    # Calculate rolling statistics for the current note sequence
    rolling_stats = calculate_rolling_statistics(user_note_history)

    # Add the current statistics to the history
    stats_dict = {
        'rolling_avg_pitch': rolling_stats[0],
        'rolling_std_pitch': rolling_stats[1],
        'mean_interval': rolling_stats[2],
        'std_interval': rolling_stats[3]
    }
    rolling_stats_history.append(stats_dict)
    if len(rolling_stats_history) > ROLLING_STATS_MAX_LEN:
        del rolling_stats_history[0]

    # Return the entire history
    return jsonify({'rolling_stats_history': rolling_stats_history})


@app.route('/reset_distribution', methods=['POST'])
def reset_distribution():
    ts.reset()
    return jsonify({'status': 'distribution reset'})

@app.route('/clear', methods=['POST'])
def clear():
    global user_note_history, successful_notes_sequence, rolling_stats_history
    user_note_history.clear()  # Reset the user note history
    successful_notes_sequence.clear()
    ts.reset()
    rolling_stats_history.clear()  # Clear the rolling stats history
    return jsonify({'status': 'cleared everything'})
@app.route('/')
def home():
    return "Welcome to the Bach Chorale Prediction App!"

if __name__ == '__main__':
    app.run(debug=True)
