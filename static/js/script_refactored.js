async function fetchAPI(url, method = 'GET', body = null) {
    const options = {
        method: method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

async function key(url, noteInt) {
    new Audio(url).play();

    try {
        const data = await fetchAPI('/predict', 'POST', { current_note: noteInt });
        document.getElementById('scoreValue').textContent = data.bach_likeness_score.toFixed(2);
        if (data.update_message) {
            document.getElementById('update-message').textContent = data.update_message;
        }

        await updateDistributionGraph();
        await updateRollingStatsHistoryGraph();
        updatePlayButtonVisibility();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function suggestNote() {
    try {
        const data = await fetchAPI('/suggest_note');
        highlightKey(data.suggested_note);
    } catch (error) {
        console.error('Error:', error);
    }
}

async function updateDistributionGraph() {
    try {
        const data = await fetchAPI('/view_distribution');
        sampling_chart.data.datasets[0].data = data.distribution;
        sampling_chart.update();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function updateRollingStatsHistoryGraph() {
    try {
        const data = await fetchAPI('/get_rolling_statistics');
        rollingStatsHistoryChart.data.labels = data.rolling_stats_history.map((_, index) => index + 1);
        rollingStatsHistoryChart.data.datasets.forEach((dataset, idx) => {
            dataset.data = data.rolling_stats_history.map(stat => stat[dataset.label.toLowerCase().replace(' ', '_')]);
        });
        rollingStatsHistoryChart.update();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function playNotesSequence() {
    try {
        const data = await fetchAPI('/get_success_sequence');
        const successfulNotesSequence = data.success_sequence.flat();
        if (successfulNotesSequence.length > 0) {
            playSequence(successfulNotesSequence, 0);
        } else {
            console.log("No successful notes to play.");
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function playSequence(notes, index) {
    if (index < notes.length) {
        let note = notes[index];
        let audio = new Audio(`/static/sounds/${note}.wav`);
        audio.play();
        audio.onended = function() {
            playSequence(notes, index + 1);
        };
    }
}

function highlightKey(note) {
    let keyElement = document.querySelector(`[data-note="${note}"]`);
    if (keyElement) {
        keyElement.classList.add('highlight');
        setTimeout(() => keyElement.classList.remove('highlight'), 4000);
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
    fetch('/view_distribution')
    .then(response => response.json())
    .then(data => {
        console.log('current');
        console.log('data')
        // Update the graph data
        sampling_chart.data.datasets[0].data = data.distribution;
        sampling_chart.update();
        console.log('updated');
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
    fetch('/get_rolling_statistics')
    .then(response => {
      console.log('got rolling stats response');
      console.log(response)
      return response.json();
    }
    )
    .then(data => {
        // console.log('hi', rollingStatsHistoryChart[0].data)
  
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
    fetch('/get_success_sequence')
    .then(response => response.json())
    .then(data => {
        console.log(data)
        const unflattenedSequence = data.success_sequence
        const successfulNotesSequence = unflattenedSequence.flat();
        
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
        let audio = new Audio(`/static/sounds/${note}.wav`);
        audio.play();
        audio.onended = function() {
            playSequence(notes, index + 1);
        };
    }
  }
  
  // function updatePlayButtonVisibility() {
  //   fetch('http://127.0.0.1:5000/get_success_sequence')
  //   .then(response => response.json())
  //   .then(data => {
  //       const successfulNotesSequence = data.success_sequence;
  //       const playButton = document.getElementById('playCompositionButton');
        
  //       if (successfulNotesSequence && successfulNotesSequence.length > 0) {
  //           playButton.style.display = 'block'; // Show the button
  //       } else {
  //           playButton.style.display = 'none'; // Hide the button
  //       }
  //   })
  //   .catch(error => {
  //       console.error('Error:', error);
  //       // Optionally handle the error case (e.g., hide the button)
  //       document.getElementById('playCompositionButton').style.display = 'none';
  //   });
  // }
  
  function updatePlayButtonVisibility() {
    fetch('/get_success_sequence')
    .then(response => {
        console.log('play button response received', response);
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        console.log('success sequence:', data);
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
  
//   function resetApplication() {
//     fetch('/clear', {
//         method: 'POST'
//     })
//     .then(response => response.json())
//     .then(data => {
//         console.log(data.status);
//         if (sampling_chart) {
//           sampling_chart.data.datasets.forEach((dataset) => {
//               dataset.data = []; // Clear the data array
//           });
//           sampling_chart.update();
//       }
//       if (rollingStatsHistoryChart) {
//           rollingStatsHistoryChart.data.labels = [];
//           rollingStatsHistoryChart.data.datasets.forEach((dataset) => {
//               dataset.data = []; // Clear the data array
//           });
//           rollingStatsHistoryChart.update();
//       }
//       updatePlayButtonVisibility();
//     })
//     .catch(error => console.error('Error:', error));
//   }
  
