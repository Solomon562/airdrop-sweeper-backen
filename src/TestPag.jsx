import React from 'react'

const TestPag = () => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-600 mb-4">
        Tailwind CSS Test
      </h1>
      <div className="bg-red-500 text-white p-4 rounded-lg">
        If this has a red background, Tailwind is working!
      </div>
      <button className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
        Test Button
      </button>
    </div>
  )
}

export default TestPag