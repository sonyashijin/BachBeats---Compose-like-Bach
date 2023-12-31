from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
from flask import render_template
import logging
import os
from thompson_sampling import DirichletMultinomialThompsonSampling
from logistic_regression import LogisticRegression
import redis
import pickle

redis_url = os.getenv('REDISCLOUD_URL', 'redis://localhost:6379')
redis_client = redis.Redis.from_url(redis_url)
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app)

user_note_history = []
successful_notes_sequence = []
rolling_stats_history = []
ROLLING_STATS_MAX_LEN = 10
model = None
last_score = None


#model = joblib.load('logistic_regression_model.pkl')

ts = DirichletMultinomialThompsonSampling(num_arms=61)

def serialize_ts(ts_object):
    return pickle.dumps(ts_object)

def save_ts_to_redis(ts_object):
    redis_client.set('thompson_sampling', serialize_ts(ts_object))

# Deserialize the object
def deserialize_ts(serialized_ts):
    return pickle.loads(serialized_ts)

# Retrieve the serialized object from Redis
def get_ts_from_redis():
    serialized_ts = redis_client.get('thompson_sampling')
    if serialized_ts:
        return deserialize_ts(serialized_ts)
    return None  

def load_and_train_model():
    global model
    combined_df = pd.read_csv('combined_dataset.csv')


    X = combined_df.drop('label', axis=1)
    y = combined_df['label']


    # Train the model
    model = LogisticRegression(learning_rate=0.001, max_iter=1000)
    model.fit(X, y)

# load and train data at start up
load_and_train_model()

def calculate_reward(initial_score, updated_score, max_change= 0.9, weight_factor=20):
    # calculate the difference in score
    score_change = updated_score - initial_score

    # normalize the change
    normalized_change = score_change / max_change

    # apply the weighting factor
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
    ts_from_redis = get_ts_from_redis()
    if ts_from_redis:
        ts = ts_from_redis
    distribution = ts.alpha.tolist()
    #logging.debug(f"/view_distribution called. current distribution: {distribution}")
    return jsonify({'distribution': distribution})

@app.route('/predict', methods=['POST'])
def predict_and_update():
    global user_note_history, last_score, ts

    ts_from_redis = get_ts_from_redis()
    if ts_from_redis:
        ts = ts_from_redis

    data = request.json
    #logging.debug(f"Received data: {data}")
    current_note = data['current_note']
    update_message = "Keep going to update distribution!"

    # Logic for the first note
    if not user_note_history:
        # if first note, have the first three notes just be the middle of piano
        user_note_history.extend([30, 30, 30])
    else:
        user_note_history.append(current_note)

    last_three_notes = np.array(user_note_history[-3:])

    # calculate average interval between the last three notes
    intervals = np.diff(last_three_notes)
    avg_interval = np.mean(intervals) if len(intervals) > 0 else 0

    # combine last two notes and current note and avg_interval for input_features
    input_features = np.append(last_three_notes, avg_interval).reshape(1, -1)
    prediction = model.predict_proba(input_features)[0]

    # update the distribution
    if last_score is not None:
        reward = calculate_reward(last_score, prediction)
        #logging.debug(f"alpha values before update: {ts.alpha}")
   
        if reward > 0:
            ts.update(current_note, reward)
            update_message = f"+{reward:.4f} reward to note {current_note}"
            successful_notes_sequence.append(current_note)
            logging.debug(f"successful_notes_sequence appended with {current_note}")
        else:
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
                    ts.update(current_note, 0)
                    update_message = f"Distribution unchanged to keep alpha > 1. Attempted decrement to note {current_note}: {reward:.4f}."
        logging.debug(f"Updated alpha for arm {current_note}: {ts.alpha[current_note]}")
        logging.debug(f"Updated alpha values: {ts.alpha}")
        
        # Debug prints
        print(f"Alpha after update: {ts.alpha[current_note]}, Update Message: {update_message}")

    # update last score
    last_score = prediction
    save_ts_to_redis(ts)
    return jsonify({'bach_likeness_score': prediction, 'update_message': update_message})

@app.route('/get_success_sequence', methods=['GET'])
def get_success_sequence():
    global successful_notes_sequence

    # Restrict the length of the successful_notes_sequence to the last 10 combinations
    if len(successful_notes_sequence) > 10:
        successful_notes_sequence = successful_notes_sequence[-10:]

    sequence = []

    for note in successful_notes_sequence:
        #print(note)
        sequence.append(note)  
        #print(sequence)

    # Convert elements to int for JSON serialization
    ser_sequence = [int(note) for note in sequence]
    return jsonify({'success_sequence': ser_sequence})

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
    global rolling_stats_history
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
    global ts
    ts.reset()
    #logging.debug("distribution reset.")
    save_ts_to_redis(ts)
    return jsonify({'status': 'distribution reset'})

@app.route('/clear', methods=['POST'])
def clear():
    global user_note_history, successful_notes_sequence, rolling_stats_history
    user_note_history.clear()  # Reset the user note history
    successful_notes_sequence.clear()
    ts.reset()
    rolling_stats_history.clear()  # Clear the rolling stats history
    redis_client.delete('thompson_sampling')
    logging.debug("TS object deleted from database")
    return jsonify({'status': 'cleared everything'})

@app.route('/')
def home():
    return render_template('index.html')


if __name__ == '__main__':
    ts = DirichletMultinomialThompsonSampling(num_arms=61)
    app.run(debug=True)
