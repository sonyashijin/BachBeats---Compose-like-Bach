import numpy as np
import logging

class DirichletMultinomialThompsonSampling:
    def __init__(self, num_arms):
        # Initialize parameters for Dirichlet distribution
        self.num_arms = num_arms
        self.alpha = np.ones(num_arms)  # Uniform prior

    def select_arm(self):
        # Draw sample from Dirichlet distribution
        sampled_probs = np.random.dirichlet(self.alpha)
        return np.argmax(sampled_probs)

    def update(self, chosen_arm, reward):
        # Update alpha parameter of the chosen arm
        logging.debug(f"Updated alpha for arm {chosen_arm}: {self.alpha[chosen_arm]}")
        self.alpha[chosen_arm] += reward
    def reset(self):
    # Reset alpha to uniform prior
        logging.debug("Resetting alpha values to uniform prior.")
        self.alpha = np.ones(self.num_arms)
