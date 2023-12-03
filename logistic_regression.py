import numpy as np
import pandas as pd

class LogisticRegression:
    def __init__(self, learning_rate=0.01, max_iter=1000):
        self.learning_rate = learning_rate
        self.max_iter = max_iter
        self.weights = None

    def sigmoid(self, z):
        return 1 / (1 + np.exp(-z))

    def fit(self, X, y):
        n_samples, n_features = X.shape
        self.weights = np.zeros(n_features)

        # Gradient Ascent
        for _ in range(self.max_iter):
            model = np.dot(X, self.weights)
            predictions = self.sigmoid(model)

            # Update weights
            gradient = np.dot(X.T, (y - predictions)) / n_samples
            self.weights += self.learning_rate * gradient

    def predict_proba(self, X):
        model = np.dot(X, self.weights)
        return self.sigmoid(model)

    def predict(self, X, threshold=0.5):
        probabilities = self.predict_proba(X)
        return np.where(probabilities >= threshold, 1, 0)



# combined_df = pd.read_csv('combined_dataset.csv')

# X = combined_df.drop('label', axis=1)
# y = combined_df['label']

# X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# model = LogisticRegression(learning_rate=0.01, max_iter=1000)
# model.fit(X_train, y_train)

# y_pred = model.predict(X_test)
# accuracy = np.mean(y_pred == y_test)
# print(f"Model Accuracy: {accuracy}")

# joblib.dump(model, 'logistic_regression_model.pkl')