let sampling_chart;

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

function resetDataOnLoad() {
  fetch('http://127.0.0.1:5000/clear')
  .then(response => response.json())
  .then(data => console.log(data.status))
  .catch(error => console.error('Error:', error));
}

document.addEventListener('DOMContentLoaded', resetDataOnLoad);



