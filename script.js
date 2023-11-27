let sampling_chart;
let rollingStatsHistoryChart;

function key(url, noteInt) {
  new Audio(url).play();

  fetch('http://127.0.0.1:5000/predict', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ current_note: noteInt }),
  })
  .then(response => response.json())
  .then(data => {
    // Update the Bach likeness score
    console.log(data)
    document.getElementById('scoreValue').textContent = data.bach_likeness_score.toFixed(2);
    // Display the update message
    if(data.update_message) {
       document.getElementById('update-message').textContent = data.update_message;
    }
    // Update the distribution graph
    if (sampling_chart) {
      updateDistributionGraph();
    }
    if (rollingStatsHistoryChart) {
      updateRollingStatsHistoryGraph();
    }
    updatePlayButtonVisibility();
  })
  .catch((error) => {
    console.error('Error:', error);
  });
}

function suggestNote() {
  // Make a fetch request to get the suggested note
  fetch('http://127.0.0.1:5000/suggest_note')
  .then(response => response.json())
  .then(data => {
      // Get the suggested note
      const suggestedNote = data.suggested_note;
      highlightKey(suggestedNote);
      console.log(data)
  })
  .catch(error => {
      console.error('Error:', error);
  });
}

function highlightKey(note) {
  let keyElement = document.querySelector(`[data-note="${note.toString()}"]`);
  console.log(keyElement)
  if (keyElement) {
      keyElement.classList.add('highlight');
      setTimeout(() => {
          keyElement.classList.remove('highlight');
      }, 4000); // Highlight for 2 seconds
  }
}

document.addEventListener('DOMContentLoaded', function() {
  sampling_chart = new Chart(document.getElementById('distribution-graph').getContext('2d'), {
      type: 'bar',
      data: {
          labels: Array.from({length: 60}, (_, i) => i + 1),
          datasets: [{
              label: 'Note Distribution',
              data: [],
              backgroundColor: '#78ffce92'
          }]
      },
      options: {
          scales: {
              y: {
                  beginAtZero: true,
                  max: 3
              }
          }
      }
  });
});

function updateDistributionGraph() {
  fetch('http://127.0.0.1:5000/view_distribution')
  .then(response => response.json())
  .then(data => {
      // Update the graph data
      sampling_chart.data.datasets[0].data = data.distribution;
      sampling_chart.update();
      console.log(data);
  })
  .catch(error => {
      console.error('Error:', error);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const ctx = document.getElementById('rolling-stats-history-graph').getContext('2d');
  rollingStatsHistoryChart = new Chart(ctx, {
      type: 'line',
      data: {
          labels: [], // Empty array, will be populated with data later
          datasets: [{
              label: 'Avg Pitch',
              data: [], // Data for rolling average pitch
              borderColor: 'blue',
              fill: false
          }, {
              label: 'Avg Interval',
              data: [], // Data for mean interval
              borderColor: 'red',
              fill: false
          }, {
              label: 'Std Pitch',
              data: [], // Data for rolling std pitch
              borderColor: 'green',
              fill: false
          }, {
              label: 'Std Interval',
              data: [], // Data for std interval
              borderColor: 'purple',
              fill: false
          }]
      },
      options: {
          responsive: true,
          plugins: {
            legend: {
                display: true,
                position: 'left',
                labels: {
                    color: '#dddedf',
                    font: {
                      family: "cairo",
                    }
                }
            },
            layout: {
              padding: {
                left: 50, // Adjust this value as needed
                // right, top, bottom as needed
              }
            }
          },
          scales: {
              y: {
                  beginAtZero: true
              }
          }
      }
  });
});

function updateRollingStatsHistoryGraph() {
  fetch('http://127.0.0.1:5000/get_rolling_statistics')
  .then(response => {
    console.log('got response');
    console.log(response)
    return response.json();
  }
  )
  .then(data => {
      // console.log('hi', rollingStatsHistoryChart[0].data)
      console.log('hi')

      const history = data.rolling_stats_history;

      // Check if history is an array
      if (!Array.isArray(history)) {
          console.log('not array')
          console.error('Invalid or missing rolling_stats_history data');
          return;
      }

      const labels = history.map((_, index) => index + 1);

      rollingStatsHistoryChart.data.labels = labels;
      rollingStatsHistoryChart.data.datasets[0].data = history.map(stat => stat.rolling_avg_pitch);
      rollingStatsHistoryChart.data.datasets[1].data = history.map(stat => stat.mean_interval);
      rollingStatsHistoryChart.data.datasets[2].data = history.map(stat => stat.rolling_std_pitch);
      rollingStatsHistoryChart.data.datasets[3].data = history.map(stat => stat.std_interval);

      console.log('data', rollingStatsHistoryChart.data.datasets[0].data)

      rollingStatsHistoryChart.update();
  })
  .catch(error => {
      console.error('Error:', error);
  });
}

function playNotesSequence() {
  fetch('http://127.0.0.1:5000/get_success_sequence')
  .then(response => response.json())
  .then(data => {
      console.log(data)
      const successfulNotesSequence = data.success_sequence;
      if (successfulNotesSequence.length > 0) {
          playSequence(successfulNotesSequence, 0);
      } else {
          console.log("No successful notes to play.");
      }
  })
  .catch(error => {
      console.error('Error:', error);
  });
}

function playSequence(notes, index) {
  if (index < notes.length) {
      let note = notes[index];
      let audio = new Audio(`sounds/${note}.wav`);
      audio.play();
      audio.onended = function() {
          playSequence(notes, index + 1);
      };
  }
}


function updatePlayButtonVisibility() {
  fetch('http://127.0.0.1:5000/get_success_sequence')
  .then(response => response.json())
  .then(data => {
      const successfulNotesSequence = data.success_sequence;
      const playButton = document.getElementById('playCompositionButton');
      
      if (successfulNotesSequence && successfulNotesSequence.length > 0) {
          playButton.style.display = 'block'; // Show the button
      } else {
          playButton.style.display = 'none'; // Hide the button
      }
  })
  .catch(error => {
      console.error('Error:', error);
      // Optionally handle the error case (e.g., hide the button)
      document.getElementById('playCompositionButton').style.display = 'none';
  });
}

function resetApplication() {
  fetch('http://127.0.0.1:5000/clear', {
      method: 'POST'
  })
  .then(response => response.json())
  .then(data => {
      console.log(data.status);
      if (sampling_chart) {
        sampling_chart.data.datasets.forEach((dataset) => {
            dataset.data = []; // Clear the data array
        });
        sampling_chart.update();
    }
    if (rollingStatsHistoryChart) {
        rollingStatsHistoryChart.data.labels = [];
        rollingStatsHistoryChart.data.datasets.forEach((dataset) => {
            dataset.data = []; // Clear the data array
        });
        rollingStatsHistoryChart.update();
    }
    updatePlayButtonVisibility();
  })
  .catch(error => console.error('Error:', error));
}


document.addEventListener('DOMContentLoaded', resetApplication);

