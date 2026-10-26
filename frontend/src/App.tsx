import { FormEvent, useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const INTERESTS = [
  'Food',
  'Culture',
  'Nature',
  'Nightlife',
  'Adventure',
  'Relaxation',
] as const

type ApiStatus = 'checking' | 'ok' | 'offline'

function App() {
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [interests, setInterests] = useState<string[]>(['Food', 'Culture'])
  const [demoMessage, setDemoMessage] = useState('')
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    let cancelled = false

    fetch(`${API_URL}/health`)
      .then(async (response) => {
        const data = (await response.json()) as { status?: string }
        if (!cancelled) {
          setApiStatus(response.ok && data.status === 'ok' ? 'ok' : 'offline')
        }
      })
      .catch(() => {
        if (!cancelled) setApiStatus('offline')
      })

    return () => {
      cancelled = true
    }
  }, [])

  function toggleInterest(interest: string) {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const place = destination.trim() || 'your destination'
    const dates =
      startDate && endDate
        ? `${startDate} to ${endDate}`
        : 'your selected dates'
    const spend = budget.trim() ? `$${budget.trim()}` : 'your budget'
    const focus =
      interests.length > 0 ? interests.join(', ') : 'a mix of experiences'

    setDemoMessage(
      `Demo itinerary for ${place} (${dates}). Estimated budget ${spend}, focused on ${focus}. Gemini is not connected yet — this is a placeholder so you can test the form.`,
    )
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          Wander
        </div>
        <p className={`status status-${apiStatus}`}>
          {apiStatus === 'checking' && 'Checking API…'}
          {apiStatus === 'ok' && 'API connected'}
          {apiStatus === 'offline' && 'API offline — start the backend'}
        </p>
      </header>

      <main className="layout">
        <section className="intro">
          <p className="eyebrow">AI trip planner · step 1</p>
          <h1>Plan a trip that actually fits how you travel.</h1>
          <p className="lede">
            Tell us where you are going, when, and what you care about. We will
            generate a day-by-day itinerary in a later step.
          </p>
        </section>

        <form className="card" onSubmit={handleSubmit}>
          <label>
            Destination
            <input
              type="text"
              name="destination"
              placeholder="Kyoto, Lisbon, Banff…"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              required
            />
          </label>

          <div className="row">
            <label>
              Start date
              <input
                type="date"
                name="startDate"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </label>
            <label>
              End date
              <input
                type="date"
                name="endDate"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </label>
          </div>

          <label>
            Budget (USD)
            <input
              type="number"
              name="budget"
              min="0"
              step="50"
              placeholder="2500"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              required
            />
          </label>

          <fieldset>
            <legend>Interests</legend>
            <div className="chips">
              {INTERESTS.map((interest) => {
                const selected = interests.includes(interest)
                return (
                  <button
                    key={interest}
                    type="button"
                    className={selected ? 'chip selected' : 'chip'}
                    aria-pressed={selected}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <button type="submit" className="generate">
            Generate Itinerary
          </button>

          {demoMessage ? (
            <p className="demo" role="status">
              {demoMessage}
            </p>
          ) : null}
        </form>
      </main>
    </div>
  )
}

export default App
